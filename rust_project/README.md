# hf-pull: Standalone Rust HuggingFace Model Weights Downloader

A high-performance, standalone terminal application written in **Rust** designed to download pure model weights straight from [huggingface.co](https://huggingface.co) into any directory for offline usage.

Unlike the default Python `huggingface_hub` tool, **hf-pull**:
- 🚀 **No Python or Symlinks**: Downloads straight weights into your destination folder without creating cache symlinks (`snapshots/...` -> `blobs/...`) that break when copied to offline servers, USB drives, or Windows environments.
- ⚡ **Multi-threaded Parallel Downloads**: Downloads large safetensors shards and model configs concurrently with Tokio.
- 🔄 **HTTP Range Resumable**: Automatically resumes partial `.part` files if connection drops.
- 🛡️ **Streaming SHA-256 Verification**: Verifies Git LFS checksums against Hugging Face metadata.
- 🔒 **Gated / Private Repo Support**: Pass your access token via `--token` or `$HF_TOKEN`.

---

## 📦 Installation

### Option 1: Build from Source
```bash
# 1. Clone or extract the project folder
cd hf-pull

# 2. Build the optimized release binary
cargo build --release

# 3. Install to your PATH
cargo install --path .
```

The binary `hf-pull` will be placed in `~/.cargo/bin/hf-pull`.

---

## 💻 Usage

### Basic Usage
Navigate to the directory where you want to download model weights, then run:

```bash
# Download model straight into current folder / subfolder
hf-pull unsloth/Qwen3.8-27B-NVFP4
```

### Specify Output Directory
```bash
hf-pull unsloth/Qwen3.8-27B-NVFP4 --output-dir ./my_weights
# or short alias:
hf-pull unsloth/Qwen3.8-27B-NVFP4 -o /mnt/models/qwen
```

### Gated or Private Models (e.g. LLaMA / DeepSeek)
```bash
hf-pull meta-llama/Llama-3.2-1B --token hf_yourTokenHere
# or set in environment:
export HF_TOKEN="hf_yourTokenHere"
hf-pull meta-llama/Llama-3.2-1B
```

### Download Only Safetensors Weights & Configs
```bash
hf-pull unsloth/Qwen3.8-27B-NVFP4 --filter "*.safetensors,*.json" --threads 8
```

### Inspect Repository Tree Without Downloading
```bash
hf-pull unsloth/Qwen3.8-27B-NVFP4 --tree-only
```

---

## 🛠️ CLI Flags & Options

| Flag | Long Option | Description | Default |
|---|---|---|---|
| `<MODEL_ID>` | Position 1 | Hugging Face model repository (e.g. `unsloth/Qwen3.8-27B-NVFP4`) | **Required** |
| `-o` | `--output-dir` | Output directory path | `./<model_name>` |
| `-t` | `--token` | Hugging Face access token (or reads `$HF_TOKEN`) | None |
| `-j` | `--threads` | Concurrent download worker threads | `4` |
| `-r` | `--revision` | Git branch, tag, or commit hash | `main` |
| `-f` | `--filter` | Comma-separated glob patterns to include | All files |
| `-e` | `--exclude` | Comma-separated glob patterns to ignore | None |
| `-v` | `--verify` | Verify SHA-256 integrity against Git LFS checksums | `true` |
| `-c` | `--resume` | Resume partial `.part` downloads | `true` |
| `-s` | `--skip-existing`| Skip existing files with matching file sizes | `true` |
| | `--flat` | Flatten directory tree into target folder root | `false` |
| | `--tree-only` | List remote file tree and size without downloading | `false` |
