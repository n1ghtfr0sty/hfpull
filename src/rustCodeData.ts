import { RustSourceFile } from "./types";

export const RUST_PROJECT_FILES: RustSourceFile[] = [
  {
    name: "Cargo.toml",
    path: "Cargo.toml",
    language: "toml",
    description: "Package manifest declaring dependencies: tokio, reqwest, indicatif, clap, sha2, colored, anyhow",
    content: `[package]
name = "hf-pull"
version = "0.1.0"
edition = "2021"
authors = ["AI Studio Rust Toolchain"]
description = "Fast, standalone Rust CLI to download straight HuggingFace model weights without symlinks"
license = "MIT OR Apache-2.0"
keywords = ["huggingface", "weights", "downloader", "llm", "cli"]
readme = "README.md"

[dependencies]
# CLI argument parsing
clap = { version = "4.5", features = ["derive", "env", "cargo"] }

# Asynchronous runtime
tokio = { version = "1.39", features = ["full"] }

# HTTP client with streaming & TLS
reqwest = { version = "0.12", default-features = false, features = [
    "rustls-tls",
    "stream",
    "json",
] }

# Multi-progress bar UI
indicatif = { version = "0.17", features = ["tokio"] }

# Futures & async utilities
futures-util = "0.3"
async-trait = "0.1"

# Serialization & JSON
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Hashing & verification
sha2 = "0.10"
hex = "0.4"

# Colored terminal output
colored = "2.1"

# Error handling
anyhow = "1.0"

# Glob pattern matching for file filters
glob = "0.3"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
`,
  },
  {
    name: "main.rs",
    path: "src/main.rs",
    language: "rust",
    description: "CLI entrypoint, banner, argument processing, orchestration of tree discovery and download engine",
    content: `//! hf-pull: Standalone Rust CLI for downloading raw Hugging Face model weights.
//!
//! Downloads straight model weights without symlinks or cache wrappers directly
//! to your target folder for offline usage.

mod auth;
mod cli;
mod downloader;
mod hf_api;
mod progress;
mod verify;

use anyhow::{Context, Result};
use clap::Parser;
use colored::*;
use std::path::PathBuf;
use std::time::Instant;

use crate::cli::Args;
use crate::downloader::Downloader;
use crate::hf_api::HfClient;

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    print_banner();

    // Determine target directory
    let output_dir = match &args.output_dir {
        Some(dir) => dir.clone(),
        None => {
            // Default to current directory + model repository name
            let model_clean = args.model.replace('/', "_");
            PathBuf::from(format!("./{}", model_clean))
        }
    };

    println!(
        "{} Target Model : {}",
        "✦".bright_cyan(),
        args.model.bright_yellow().bold()
    );
    println!(
        "{} Destination  : {}",
        "✦".bright_cyan(),
        output_dir.display().to_string().bright_green()
    );
    println!(
        "{} Revision     : {}",
        "✦".bright_cyan(),
        args.revision.bright_blue()
    );
    println!(
        "{} Workers      : {}",
        "✦".bright_cyan(),
        args.threads.to_string().bright_magenta()
    );

    // Initialize HuggingFace API Client
    let client = HfClient::new(&args.model, &args.revision, args.token.clone())?;

    println!("\\n{} Querying HuggingFace API for repository tree...", "→".bright_blue());
    let mut files = client.fetch_file_tree().await.context("Failed to fetch model file tree from Hugging Face")?;

    if files.is_empty() {
        println!("{} No files found in repository {}.", "!".bright_red(), args.model);
        return Ok(());
    }

    // Apply include/exclude filters
    files = downloader::filter_files(files, &args.filter, &args.exclude);

    let total_bytes: u64 = files.iter().map(|f| f.size).sum();
    let total_gb = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

    println!(
        "{} Found {} matching files ({:.2} GB total straight weights)\\n",
        "✔".bright_green().bold(),
        files.len().to_string().bright_white().bold(),
        total_gb
    );

    // If --tree-only flag is passed, just list files and exit
    if args.tree_only {
        println!("{:<50} {:>12} {:>8}", "FILE PATH", "SIZE", "LFS");
        println!("{}", "-".repeat(74).dimmed());
        for f in &files {
            let size_str = format_bytes(f.size);
            let lfs_str = if f.lfs { "yes" } else { "no" };
            println!("{:<50} {:>12} {:>8}", f.path, size_str, lfs_str);
        }
        return Ok(());
    }

    // Ensure output directory exists
    tokio::fs::create_dir_all(&output_dir)
        .await
        .with_context(|| format!("Failed to create output directory {}", output_dir.display()))?;

    // Start download engine
    let start_time = Instant::now();
    let downloader = Downloader::new(args.clone(), output_dir.clone());

    downloader.download_all(files).await?;

    let elapsed = start_time.elapsed();
    let elapsed_secs = elapsed.as_secs_f64().max(0.001);
    let avg_speed_mb = (total_bytes as f64 / (1024.0 * 1024.0)) / elapsed_secs;

    println!("\\n{}", "=".repeat(70).bright_green());
    println!(
        "{} {} Model weights successfully downloaded!",
        "✔".bright_green().bold(),
        "COMPLETED:".bright_white().bold()
    );
    println!("  • Location: {}", output_dir.canonicalize().unwrap_or(output_dir).display().to_string().bright_cyan());
    println!("  • Time:     {:.1}s", elapsed_secs);
    println!("  • Speed:    {:.2} MB/s average", avg_speed_mb);
    println!("  • Weights:  Direct straight files (no symlinks / no HF cache wrappers)");
    println!("{}", "=".repeat(70).bright_green());

    Ok(())
}

fn print_banner() {
    println!("{}", "=========================================================".bright_cyan());
    println!("{}", "  ██╗  ██╗███████╗   ██████╗ ██╗   ██╗██╗     ██╗     ".bright_yellow().bold());
    println!("{}", "  ██║  ██║██╔════╝   ██╔══██╗██║   ██║██║     ██║     ".bright_yellow().bold());
    println!("{}", "  ███████║█████╗     ██████╔╝██║   ██║██║     ██║     ".bright_yellow().bold());
    println!("{}", "  ██╔══██║██╔══╝     ██╔═══╝ ██║   ██║██║     ██║     ".bright_yellow().bold());
    println!("{}", "  ██║  ██║██║        ██║     ╚██████╔╝███████╗███████╗".bright_yellow().bold());
    println!("{}", "  ╚═╝  ╚═╝╚═╝        ╚═╝      ╚═════╝ ╚══════╝╚══════╝".bright_yellow().bold());
    println!("  HuggingFace Raw Weights Downloader (Standalone Rust CLI)");
    println!("{}", "=========================================================".bright_cyan());
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if bytes >= 1024 * 1024 {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.2} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}
`,
  },
  {
    name: "cli.rs",
    path: "src/cli.rs",
    language: "rust",
    description: "Clap command-line parser with flags for output dir, threads, auth token, filters, and verification",
    content: `use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(
    name = "hf-pull",
    author = "Rust HuggingFace CLI Tool",
    version = "0.1.0",
    about = "Download direct offline Hugging Face model weights without symlinks",
    long_about = "Fast, multi-threaded, resumable downloader for HuggingFace models. \\n\\
                  Downloads pure straight weights (safetensors, bin, json configs) directly into \\n\\
                  the destination folder without creating symlinks or requiring python."
)]
pub struct Args {
    /// Hugging Face model repository ID (e.g. 'unsloth/Qwen3.8-27B-NVFP4' or 'meta-llama/Llama-3.2-1B')
    #[arg(value_name = "MODEL_ID", required = true)]
    pub model: String,

    /// Target output directory to save straight model weights into
    #[arg(short = 'o', long = "output-dir", value_name = "DIR")]
    pub output_dir: Option<PathBuf>,

    /// Hugging Face User Access Token for gated or private models (or read from $HF_TOKEN)
    #[arg(short = 't', long = "token", env = "HF_TOKEN")]
    pub token: Option<String>,

    /// Model branch, tag, or commit hash to download from
    #[arg(short = 'r', long = "revision", default_value = "main")]
    pub revision: String,

    /// Number of concurrent file download worker threads
    #[arg(short = 'j', long = "threads", default_value_t = 4)]
    pub threads: usize,

    /// Comma-separated glob patterns to include (e.g. '*.safetensors,*.json,tokenizer*')
    #[arg(short = 'f', long = "filter")]
    pub filter: Option<String>,

    /// Comma-separated glob patterns to exclude (e.g. '*.bin,*.onnx,*.msgpack')
    #[arg(short = 'e', long = "exclude")]
    pub exclude: Option<String>,

    /// Verify SHA-256 integrity checksums against Hugging Face Git LFS metadata after download
    #[arg(short = 'v', long = "verify", default_value_t = true)]
    pub verify: bool,

    /// Resume partially downloaded files (.part) using HTTP Range headers
    #[arg(short = 'c', long = "resume", default_value_t = true)]
    pub resume: bool,

    /// Skip files if destination file already exists and size matches
    #[arg(short = 's', long = "skip-existing", default_value_t = true)]
    pub skip_existing: bool,

    /// Flatten directory hierarchy (save all files in root output folder without subdirectories)
    #[arg(long = "flat", default_value_t = false)]
    pub flat: bool,

    /// List model repository file tree and total size without downloading
    #[arg(long = "tree-only", default_value_t = false)]
    pub tree_only: bool,

    /// Quiet mode (suppress non-error logs and progress bars)
    #[arg(short = 'q', long = "quiet", default_value_t = false)]
    pub quiet: bool,
}
`,
  },
  {
    name: "hf_api.rs",
    path: "src/hf_api.rs",
    language: "rust",
    description: "Hugging Face REST API client fetching recursive file trees, sizes, Git LFS info, and direct CDN URLs",
    content: `use anyhow::{bail, Context, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfFileEntry {
    pub path: String,
    pub size: u64,
    pub lfs: bool,
    pub sha256: Option<String>,
    pub direct_url: String,
}

#[derive(Debug, Deserialize)]
struct ApiTreeItem {
    path: Option<String>,
    rfilename: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    size: Option<u64>,
    lfs: Option<ApiLfsInfo>,
    oid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiLfsInfo {
    size: Option<u64>,
    sha256: Option<String>,
    oid: Option<String>,
}

pub struct HfClient {
    client: reqwest::Client,
    model: String,
    revision: String,
    token: Option<String>,
}

impl HfClient {
    pub fn new(model: &str, revision: &str, token: Option<String>) -> Result<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("hf-pull-rust/0.1.0 (standalone-downloader)"),
        );

        if let Some(ref t) = token {
            let auth_val = format!("Bearer {}", t.trim());
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&auth_val)
                    .context("Invalid token format for Authorization header")?,
            );
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()?;

        Ok(Self {
            client,
            model: model.to_string(),
            revision: revision.to_string(),
            token,
        })
    }

    /// Fetch all files in the model repository recursively
    pub async fn fetch_file_tree(&self) -> Result<Vec<HfFileEntry>> {
        let tree_url = format!(
            "https://huggingface.co/api/models/{}/tree/{}?recursive=true",
            self.model, self.revision
        );

        let resp = self.client.get(&tree_url).send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();

            if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
                bail!(
                    "Authentication failed ({}) for model '{}'. Gated or private models require an access token.\\n\\
                     Pass --token <HF_TOKEN> or set the HF_TOKEN environment variable.",
                    status,
                    self.model
                );
            }

            bail!(
                "Hugging Face API returned status {}: {}\\nCheck if the model name '{}' is spelled correctly.",
                status,
                body,
                self.model
            );
        }

        let items: Vec<ApiTreeItem> = resp.json().await.context("Failed to parse HuggingFace tree response")?;

        let mut results = Vec::new();

        for item in items {
            // Only consider file types
            if let Some(ref it) = item.item_type {
                if it != "file" {
                    continue;
                }
            }

            let file_path = item.path.or(item.rfilename).unwrap_or_default();
            if file_path.is_empty() || file_path.starts_with(".git") {
                continue;
            }

            let (size, is_lfs, sha256) = if let Some(lfs) = item.lfs {
                (
                    lfs.size.or(item.size).unwrap_or(0),
                    true,
                    lfs.sha256.or(lfs.oid),
                )
            } else {
                (item.size.unwrap_or(0), false, item.oid)
            };

            // Direct download URL (HuggingFace automatically redirects resolve to CDN / raw byte endpoints)
            let direct_url = format!(
                "https://huggingface.co/{}/resolve/{}/{}",
                self.model, self.revision, file_path
            );

            results.push(HfFileEntry {
                path: file_path,
                size,
                lfs: is_lfs,
                sha256,
                direct_url,
            });
        }

        Ok(results)
    }

    pub fn client(&self) -> &reqwest::Client {
        &self.client
    }

    pub fn token(&self) -> Option<&str> {
        self.token.as_deref()
    }
}
`,
  },
  {
    name: "downloader.rs",
    path: "src/downloader.rs",
    language: "rust",
    description: "Parallel multi-threaded chunked streaming engine with HTTP Range resume and atomic file writes",
    content: `use anyhow::{bail, Context, Result};
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

        // Wait for all worker tasks
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
    // Resolve local destination path
    let target_path = if args.flat {
        let filename = Path::new(&file.path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        output_dir.join(filename.as_ref())
    } else {
        output_dir.join(&file.path)
    };

    // Ensure parent directories exist
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create directory {}", parent.display()))?;
    }

    // Check if final file already exists with identical size
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

    // Check for existing partial download for resume
    if part_path.exists() && args.resume {
        if let Ok(meta) = fs::metadata(&part_path).await {
            downloaded_bytes = meta.len();
            if downloaded_bytes >= file.size && file.size > 0 {
                // Already complete in .part
                fs::rename(&part_path, &target_path).await?;
                progress.inc_completed(file.size, &file.path);
                return Ok(());
            }
        }
    }

    // Build HTTP GET request
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

    // Open file for streaming chunks
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

    // Atomic rename from .part to final destination
    fs::rename(&part_path, &target_path)
        .await
        .with_context(|| format!("Failed to rename {} to {}", part_path.display(), target_path.display()))?;

    progress.finish_file_bar(pb);

    // Verify SHA-256 integrity if requested
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
            // Check include filters
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

            // Check exclude filters
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
`,
  },
  {
    name: "progress.rs",
    path: "src/progress.rs",
    language: "rust",
    description: "Indicatif multi-progress bar manager with ETA, speed gauge, and per-file active streaming lanes",
    content: `use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
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

        // Truncate filename if too long for clean terminal display
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
`,
  },
  {
    name: "verify.rs",
    path: "src/verify.rs",
    language: "rust",
    description: "Streaming SHA-256 integrity verification against Hugging Face Git LFS checksums",
    content: `use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

/// Stream a file from disk and compute its SHA-256 hash
pub async fn verify_sha256(path: &Path, expected_hex: &str) -> Result<()> {
    let mut file = File::open(path)
        .await
        .with_context(|| format!("Failed to open {} for integrity verification", path.display()))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024]; // 1MB buffer

    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let result = hasher.finalize();
    let calculated_hex = hex::encode(result);

    if !calculated_hex.eq_ignore_ascii_case(expected_hex.trim()) {
        bail!(
            "SHA-256 checksum mismatch for '{}':\\n  Expected:   {}\\n  Calculated: {}",
            path.display(),
            expected_hex,
            calculated_hex
        );
    }

    Ok(())
}
`,
  },
  {
    name: "auth.rs",
    path: "src/auth.rs",
    language: "rust",
    description: "Token resolution from CLI argument, environment variable $HF_TOKEN, or ~/.huggingface/token",
    content: `use std::env;
use std::fs;
use std::path::PathBuf;

/// Resolve HuggingFace access token from:
/// 1. Explicit CLI argument (--token)
/// 2. HF_TOKEN environment variable
/// 3. HUGGING_FACE_HUB_TOKEN environment variable
/// 4. ~/.cache/huggingface/token or ~/.huggingface/token
pub fn resolve_token(cli_token: Option<String>) -> Option<String> {
    if let Some(t) = cli_token {
        if !t.trim().is_empty() {
            return Some(t.trim().to_string());
        }
    }

    if let Ok(t) = env::var("HF_TOKEN") {
        if !t.trim().is_empty() {
            return Some(t.trim().to_string());
        }
    }

    if let Ok(t) = env::var("HUGGING_FACE_HUB_TOKEN") {
        if !t.trim().is_empty() {
            return Some(t.trim().to_string());
        }
    }

    // Try standard HuggingFace token cache paths
    if let Some(home) = dirs_next::home_dir() {
        let path1 = home.join(".cache").join("huggingface").join("token");
        if let Ok(content) = fs::read_to_string(path1) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }

        let path2 = home.join(".huggingface").join("token");
        if let Ok(content) = fs::read_to_string(path2) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}
`,
  },
  {
    name: "single_file_script.rs",
    path: "single_file_script.rs",
    language: "rust",
    description: "Complete single-file self-contained Rust script runnable with `cargo -Zscript` or quick compile",
    content: `#!/usr/bin/env cargo
//! \`\`\`cargo
//! [dependencies]
//! clap = { version = "4.5", features = ["derive"] }
//! tokio = { version = "1.39", features = ["full"] }
//! reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream", "json"] }
//! indicatif = { version = "0.17" }
//! futures-util = "0.3"
//! serde = { version = "1.0", features = ["derive"] }
//! serde_json = "1.0"
//! anyhow = "1.0"
//! \`\`\`

use anyhow::{Context, Result};
use clap::Parser;
use futures_util::StreamExt;
use indicatif::{ProgressBar, ProgressStyle};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

#[derive(Parser, Debug)]
#[command(name = "hf-pull-lite", about = "Single-file Rust Hugging Face weight downloader")]
struct Args {
    /// Model name on Hugging Face (e.g. unsloth/Qwen3.8-27B-NVFP4)
    model: String,

    /// Target output directory
    #[arg(short, long)]
    output_dir: Option<PathBuf>,

    /// Hugging Face access token
    #[arg(short, long, env = "HF_TOKEN")]
    token: Option<String>,
}

#[derive(Deserialize)]
struct TreeItem {
    path: Option<String>,
    rfilename: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    size: Option<u64>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let dest_dir = args.output_dir.unwrap_or_else(|| {
        PathBuf::from(format!("./{}", args.model.replace('/', "_")))
    });

    println!("Fetching model tree for {}...", args.model);
    fs::create_dir_all(&dest_dir).await?;

    let client = reqwest::Client::new();
    let mut req = client.get(format!("https://huggingface.co/api/models/{}/tree/main?recursive=true", args.model));
    if let Some(ref t) = args.token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }

    let items: Vec<TreeItem> = req.send().await?.json().await?;
    let files: Vec<String> = items
        .into_iter()
        .filter(|i| i.item_type.as_deref() == Some("file"))
        .filter_map(|i| i.path.or(i.rfilename))
        .collect();

    println!("Found {} files to download directly into {}\\n", files.len(), dest_dir.display());

    for (idx, file_path) in files.iter().enumerate() {
        let dest_file = dest_dir.join(file_path);
        if let Some(p) = dest_file.parent() {
            fs::create_dir_all(p).await?;
        }

        let url = format!("https://huggingface.co/{}/resolve/main/{}", args.model, file_path);
        println!("[{}/{}] Downloading: {}", idx + 1, files.len(), file_path);

        let mut file_req = client.get(&url);
        if let Some(ref t) = args.token {
            file_req = file_req.header("Authorization", format!("Bearer {}", t));
        }

        let resp = file_req.send().await?;
        let total_size = resp.content_length().unwrap_or(0);

        let pb = ProgressBar::new(total_size);
        pb.set_style(ProgressStyle::default_bar()
            .template("  [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
            .unwrap());

        let mut file = File::create(&dest_file).await?;
        let mut stream = resp.bytes_stream();

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res?;
            file.write_all(&chunk).await?;
            pb.inc(chunk.len() as u64);
        }

        file.flush().await?;
        pb.finish_with_message("Done");
    }

    println!("\\nAll weights downloaded successfully without symlinks!");
    Ok(())
}
`,
  },
  {
    name: "README.md",
    path: "README.md",
    language: "markdown",
    description: "Complete documentation, build instructions, and CLI flag guide",
    content: `# hf-pull: Standalone Rust HuggingFace Model Weights Downloader

A high-performance, standalone terminal application written in **Rust** designed to download pure model weights straight from [huggingface.co](https://huggingface.co) into any directory for offline usage.

Unlike the default Python \`huggingface_hub\` tool, **hf-pull**:
- 🚀 **No Python or Symlinks**: Downloads straight weights into your destination folder without creating cache symlinks (\`snapshots/...\` -> \`blobs/...\`) that break when copied to offline servers, USB drives, or Windows environments.
- ⚡ **Multi-threaded Parallel Downloads**: Downloads large safetensors shards and model configs concurrently with Tokio.
- 🔄 **HTTP Range Resumable**: Automatically resumes partial \`.part\` files if connection drops.
- 🛡️ **Streaming SHA-256 Verification**: Verifies Git LFS checksums against Hugging Face metadata.
- 🔒 **Gated / Private Repo Support**: Pass your access token via \`--token\` or \`$HF_TOKEN\`.

---

## 📦 Installation

### Option 1: Build from Source
\`\`\`bash
# 1. Clone or extract the project folder
cd hf-pull

# 2. Build the optimized release binary
cargo build --release

# 3. Install to your PATH
cargo install --path .
\`\`\`

The binary \`hf-pull\` will be placed in \`~/.cargo/bin/hf-pull\`.

---

## 💻 Usage

### Basic Usage
Navigate to the directory where you want to download model weights, then run:

\`\`\`bash
# Download model straight into current folder / subfolder
hf-pull unsloth/Qwen3.8-27B-NVFP4
\`\`\`

### Specify Output Directory
\`\`\`bash
hf-pull unsloth/Qwen3.8-27B-NVFP4 --output-dir ./my_weights
# or short alias:
hf-pull unsloth/Qwen3.8-27B-NVFP4 -o /mnt/models/qwen
\`\`\`

### Gated or Private Models (e.g. LLaMA / DeepSeek)
\`\`\`bash
hf-pull meta-llama/Llama-3.2-1B --token hf_yourTokenHere
# or set in environment:
export HF_TOKEN="hf_yourTokenHere"
hf-pull meta-llama/Llama-3.2-1B
\`\`\`

### Download Only Safetensors Weights & Configs
\`\`\`bash
hf-pull unsloth/Qwen3.8-27B-NVFP4 --filter "*.safetensors,*.json" --threads 8
\`\`\`

### Inspect Repository Tree Without Downloading
\`\`\`bash
hf-pull unsloth/Qwen3.8-27B-NVFP4 --tree-only
\`\`\`

---

## 🛠️ CLI Flags & Options

| Flag | Long Option | Description | Default |
|---|---|---|---|
| \`<MODEL_ID>\` | Position 1 | Hugging Face model repository (e.g. \`unsloth/Qwen3.8-27B-NVFP4\`) | **Required** |
| \`-o\` | \`--output-dir\` | Output directory path | \`./<model_name>\` |
| \`-t\` | \`--token\` | Hugging Face access token (or reads \`$HF_TOKEN\`) | None |
| \`-j\` | \`--threads\` | Concurrent download worker threads | \`4\` |
| \`-r\` | \`--revision\` | Git branch, tag, or commit hash | \`main\` |
| \`-f\` | \`--filter\` | Comma-separated glob patterns to include | All files |
| \`-e\` | \`--exclude\` | Comma-separated glob patterns to ignore | None |
| \`-v\` | \`--verify\` | Verify SHA-256 integrity against Git LFS checksums | \`true\` |
| \`-c\` | \`--resume\` | Resume partial \`.part\` downloads | \`true\` |
| \`-s\` | \`--skip-existing\`| Skip existing files with matching file sizes | \`true\` |
| | \`--flat\` | Flatten directory tree into target folder root | \`false\` |
| | \`--tree-only\` | List remote file tree and size without downloading | \`false\` |
`,
  },
  {
    name: "install.sh",
    path: "install.sh",
    language: "bash",
    description: "Automated bash install script to compile and place binary in /usr/local/bin or ~/.cargo/bin",
    content: `#!/usr/bin/env bash
set -e

echo "🚀 Building hf-pull standalone Rust binary..."

if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo/Rust is not installed. Please install Rust from https://rustup.rs"
    exit 1
fi

cargo build --release

BIN_PATH="target/release/hf-pull"
if [ -f "$BIN_PATH" ]; then
    echo "✔ Build complete!"
    echo "Installing binary to ~/.cargo/bin/hf-pull..."
    mkdir -p ~/.cargo/bin
    cp "$BIN_PATH" ~/.cargo/bin/hf-pull
    echo "✨ Installed! You can now run: hf-pull unsloth/Qwen3.8-27B-NVFP4"
else
    echo "❌ Binary not found at $BIN_PATH"
    exit 1
fi
`,
  },
];
