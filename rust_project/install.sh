#!/usr/bin/env bash
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
