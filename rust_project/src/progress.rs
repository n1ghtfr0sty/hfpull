use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

pub struct DownloadProgressManager {
    multi: MultiProgress,
    overall_bar: ProgressBar,
    total_bytes: u64,
    downloaded: AtomicU64,
    quiet: bool,
}

impl DownloadProgressManager {
    pub fn new(total_files: usize, total_bytes: u64, quiet: bool) -> Self {
        let multi = MultiProgress::new();

        let overall_style = ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta}) {msg}")
            .expect("Invalid progress bar template")
            .progress_chars("#>-");

        let overall_bar = if quiet {
            ProgressBar::hidden()
        } else {
            multi.add(ProgressBar::new(total_bytes))
        };

        overall_bar.set_style(overall_style);
        overall_bar.set_message(format!("Total [0/{} files]", total_files));

        Self {
            multi,
            overall_bar,
            total_bytes,
            downloaded: AtomicU64::new(0),
            quiet,
        }
    }

    pub fn add_file_bar(&self, file_path: &str, file_size: u64, initial_pos: u64) -> ProgressBar {
        if self.quiet {
            return ProgressBar::hidden();
        }

        let style = ProgressStyle::default_bar()
            .template("  ↳ {msg:<32} [{bar:24.yellow/dim}] {bytes:>9}/{total_bytes:<9} {binary_bytes_per_sec:>10}")
            .expect("Invalid progress bar template")
            .progress_chars("━╾─");

        let pb = self.multi.add(ProgressBar::new(file_size));
        pb.set_style(style);

        let display_name = if file_path.len() > 30 {
            format!("...{}", &file_path[file_path.len() - 27..])
        } else {
            file_path.to_string()
        };

        pb.set_message(display_name);
        pb.set_position(initial_pos);
        pb
    }

    pub fn inc_bytes(&self, bytes: u64, file_bar: &ProgressBar) {
        file_bar.inc(bytes);
        self.overall_bar.inc(bytes);
        self.downloaded.fetch_add(bytes, Ordering::Relaxed);
    }

    pub fn inc_skipped(&self, bytes: u64, _file_path: &str) {
        self.overall_bar.inc(bytes);
        self.downloaded.fetch_add(bytes, Ordering::Relaxed);
    }

    pub fn inc_completed(&self, bytes: u64, _file_path: &str) {
        self.overall_bar.inc(bytes);
        self.downloaded.fetch_add(bytes, Ordering::Relaxed);
    }

    pub fn finish_file_bar(&self, file_bar: ProgressBar) {
        file_bar.finish_and_clear();
        let _ = self.multi.remove(&file_bar);
    }

    pub fn finish_all(&self) {
        self.overall_bar.finish_with_message("Download Complete!");
    }
}
