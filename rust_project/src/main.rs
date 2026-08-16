//! hf-pull: Standalone Rust CLI for downloading raw Hugging Face model weights.
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

    println!("\n{} Querying HuggingFace API for repository tree...", "→".bright_blue());
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
        "{} Found {} matching files ({:.2} GB total straight weights)\n",
        "✔".bright_green().bold(),
        files.len().to_string().bright_white().bold(),
        total_gb
    );

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

    tokio::fs::create_dir_all(&output_dir)
        .await
        .with_context(|| format!("Failed to create output directory {}", output_dir.display()))?;

    let start_time = Instant::now();
    let downloader = Downloader::new(args.clone(), output_dir.clone());

    downloader.download_all(files).await?;

    let elapsed = start_time.elapsed();
    let elapsed_secs = elapsed.as_secs_f64().max(0.001);
    let avg_speed_mb = (total_bytes as f64 / (1024.0 * 1024.0)) / elapsed_secs;

    println!("\n{}", "=".repeat(70).bright_green());
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
