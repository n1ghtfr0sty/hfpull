use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(
    name = "hf-pull",
    author = "Rust HuggingFace CLI Tool",
    version = "0.1.0",
    about = "Download direct offline Hugging Face model weights without symlinks",
    long_about = "Fast, multi-threaded, resumable downloader for HuggingFace models. \n\
                  Downloads pure straight weights (safetensors, bin, json configs) directly into \n\
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
