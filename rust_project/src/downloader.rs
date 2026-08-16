use anyhow::{bail, Context, Result};
use futures_util::StreamExt;
use glob::Pattern;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs::{self, File, OpenOptions};
use tokio::io::{AsyncSeekExt, AsyncWriteExt, SeekFrom};
use tokio::sync::Semaphore;

use crate::cli::Args;
use crate::hf_api::HfFileEntry;
use crate::progress::DownloadProgressManager;
use crate::verify::verify_sha256;

pub struct Downloader {
    args: Args,
    output_dir: PathBuf,
    client: reqwest::Client,
}

impl Downloader {
    pub fn new(args: Args, output_dir: PathBuf) -> Self {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::limited(15))
            .build()
            .unwrap_or_default();

        Self {
            args,
            output_dir,
            client,
        }
    }

    pub async fn download_all(&self, files: Vec<HfFileEntry>) -> Result<()> {
        let total_bytes: u64 = files.iter().map(|f| f.size).sum();
        let total_files = files.len();

        let progress = DownloadProgressManager::new(total_files, total_bytes, self.args.quiet);
        let progress = Arc::new(progress);

        let semaphore = Arc::new(Semaphore::new(self.args.threads));
        let mut tasks = Vec::new();

        for file in files {
            let sem = semaphore.clone();
            let prog = progress.clone();
            let client = self.client.clone();
            let args = self.args.clone();
            let out_dir = self.output_dir.clone();

            let task = tokio::spawn(async move {
                let _permit = sem.acquire().await.expect("Semaphore acquire error");
                download_single_file(client, file, &out_dir, &args, &prog).await
            });

            tasks.push(task);
        }

        for task in tasks {
            task.await??;
        }

        progress.finish_all();
        Ok(())
    }
}

async fn download_single_file(
    client: reqwest::Client,
    file: HfFileEntry,
    output_dir: &Path,
    args: &Args,
    progress: &Arc<DownloadProgressManager>,
) -> Result<()> {
    let target_path = if args.flat {
        let filename = Path::new(&file.path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        output_dir.join(filename.as_ref())
    } else {
        output_dir.join(&file.path)
    };

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create directory {}", parent.display()))?;
    }

    if target_path.exists() && args.skip_existing {
        if let Ok(metadata) = fs::metadata(&target_path).await {
            if metadata.len() == file.size && file.size > 0 {
                progress.inc_skipped(file.size, &file.path);
                return Ok(());
            }
        }
    }

    let part_path = PathBuf::from(format!("{}.part", target_path.display()));
    let mut downloaded_bytes = 0u64;

    if part_path.exists() && args.resume {
        if let Ok(meta) = fs::metadata(&part_path).await {
            downloaded_bytes = meta.len();
            if downloaded_bytes >= file.size && file.size > 0 {
                fs::rename(&part_path, &target_path).await?;
                progress.inc_completed(file.size, &file.path);
                return Ok(());
            }
        }
    }

    let mut req = client.get(&file.direct_url);

    if let Some(ref t) = args.token {
        req = req.header("Authorization", format!("Bearer {}", t.trim()));
    }

    if downloaded_bytes > 0 {
        req = req.header("Range", format!("bytes={}-", downloaded_bytes));
    }

    let resp = req.send().await.with_context(|| {
        format!("Failed to connect to {}", file.direct_url)
    })?;

    if !resp.status().is_success() && resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        bail!(
            "Failed to download '{}': HTTP {} - {}",
            file.path,
            resp.status(),
            resp.status().canonical_reason().unwrap_or("Error")
        );
    }

    let mut file_handle = if downloaded_bytes > 0 {
        let mut f = OpenOptions::new()
            .write(true)
            .append(true)
            .open(&part_path)
            .await
            .with_context(|| format!("Failed to open partial file {}", part_path.display()))?;
        f.seek(SeekFrom::End(0)).await?;
        f
    } else {
        File::create(&part_path)
            .await
            .with_context(|| format!("Failed to create file {}", part_path.display()))?
    };

    let pb = progress.add_file_bar(&file.path, file.size, downloaded_bytes);

    let mut stream = resp.bytes_stream();
    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.with_context(|| format!("Error reading stream for {}", file.path))?;
        file_handle.write_all(&chunk).await?;
        let len = chunk.len() as u64;
        progress.inc_bytes(len, &pb);
    }

    file_handle.flush().await?;
    drop(file_handle);

    fs::rename(&part_path, &target_path)
        .await
        .with_context(|| format!("Failed to rename {} to {}", part_path.display(), target_path.display()))?;

    progress.finish_file_bar(pb);

    if args.verify {
        if let Some(ref expected_sha) = file.sha256 {
            verify_sha256(&target_path, expected_sha).await.with_context(|| {
                format!("Checksum verification failed for file {}", target_path.display())
            })?;
        }
    }

    Ok(())
}

pub fn filter_files(files: Vec<HfFileEntry>, include: &Option<String>, exclude: &Option<String>) -> Vec<HfFileEntry> {
    let include_patterns: Vec<Pattern> = include
        .as_ref()
        .map(|s| {
            s.split(',')
                .filter_map(|p| Pattern::new(p.trim()).ok())
                .collect()
        })
        .unwrap_or_default();

    let exclude_patterns: Vec<Pattern> = exclude
        .as_ref()
        .map(|s| {
            s.split(',')
                .filter_map(|p| Pattern::new(p.trim()).ok())
                .collect()
        })
        .unwrap_or_default();

    files
        .into_iter()
        .filter(|f| {
            if !include_patterns.is_empty() {
                let matches_any = include_patterns.iter().any(|pat| {
                    pat.matches(&f.path)
                        || Path::new(&f.path)
                            .file_name()
                            .map(|n| pat.matches(n.to_string_lossy().as_ref()))
                            .unwrap_or(false)
                });
                if !matches_any {
                    return false;
                }
            }

            if !exclude_patterns.is_empty() {
                let matches_exclude = exclude_patterns.iter().any(|pat| {
                    pat.matches(&f.path)
                        || Path::new(&f.path)
                            .file_name()
                            .map(|n| pat.matches(n.to_string_lossy().as_ref()))
                            .unwrap_or(false)
                });
                if matches_exclude {
                    return false;
                }
            }

            true
        })
        .collect()
}
