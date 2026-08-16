#!/usr/bin/env cargo
//! ```cargo
//! [dependencies]
//! clap = { version = "4.5", features = ["derive"] }
//! tokio = { version = "1.39", features = ["full"] }
//! reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream", "json"] }
//! indicatif = { version = "0.17" }
//! futures-util = "0.3"
//! serde = { version = "1.0", features = ["derive"] }
//! serde_json = "1.0"
//! anyhow = "1.0"
//! ```

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

    println!("Found {} files to download directly into {}\n", files.len(), dest_dir.display());

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

    println!("\nAll weights downloaded successfully without symlinks!");
    Ok(())
}
