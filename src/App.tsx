import React, { useState } from "react";
import { TerminalSimulator } from "./components/TerminalSimulator";
import { ModelExplorer } from "./components/ModelExplorer";
import { RustCodeViewer } from "./components/RustCodeViewer";
import { CliCommandBuilder } from "./components/CliCommandBuilder";
import { Terminal, Database, Code, Sliders, BookOpen, Download, Cpu, HardDrive, ShieldCheck, Zap, ExternalLink, Sparkles } from "lucide-react";

type ActiveTab = "terminal" | "explorer" | "code" | "builder" | "docs";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("terminal");
  const [activeModel, setActiveModel] = useState<string>("unsloth/Qwen3.8-27B-NVFP4");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            {/* Rust + HF Logo Badge */}
            <div className="flex items-center space-x-1.5 p-2 bg-slate-950 border border-slate-700 rounded-xl shadow-inner">
              <span className="text-xl" title="Rust">🦀</span>
              <span className="text-sm font-black text-amber-400 font-mono">hf-pull</span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-slate-100 leading-tight">
                  Rust HuggingFace Weight Downloader
                </h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                  Zero Symlinks
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Downloads straight offline weights for models like <code className="text-amber-300 font-mono">{activeModel}</code>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              id="tab-terminal-btn"
              onClick={() => setActiveTab("terminal")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "terminal"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CLI Terminal</span>
            </button>

            <button
              id="tab-explorer-btn"
              onClick={() => setActiveTab("explorer")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "explorer"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Model Explorer</span>
            </button>

            <button
              id="tab-code-btn"
              onClick={() => setActiveTab("code")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "code"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Rust Source (.rs)</span>
            </button>

            <button
              id="tab-builder-btn"
              onClick={() => setActiveTab("builder")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "builder"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Flag Builder</span>
            </button>

            <button
              id="tab-docs-btn"
              onClick={() => setActiveTab("docs")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "docs"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Offline Guide</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TAB 1: TERMINAL SIMULATOR */}
        {activeTab === "terminal" && (
          <div className="space-y-6">
            <div className="h-[620px]">
              <TerminalSimulator
                initialModel={activeModel}
                onSelectModel={(m) => setActiveModel(m)}
                onOpenCode={() => setActiveTab("code")}
              />
            </div>

            {/* Quick Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400">
                  <HardDrive className="w-4 h-4" />
                  <span className="font-bold text-sm">Straight Weights (No Symlinks)</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Downloads raw byte files (<code className="text-slate-200 font-mono">*.safetensors</code>, configs) directly to the target path without Python cache blobs or broken relative links.
                </p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Zap className="w-4 h-4" />
                  <span className="font-bold text-sm">Async Multi-threaded Streams</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Powered by Tokio + Reqwest with HTTP Range resume (<code className="text-slate-200 font-mono">.part</code> files) and multi-channel atomic rename.
                </p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-bold text-sm">Git LFS Checksum Verification</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Streaming SHA-256 verification against Hugging Face Git LFS metadata guarantees zero corrupted weight shards.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MODEL EXPLORER */}
        {activeTab === "explorer" && (
          <ModelExplorer
            currentModel={activeModel}
            onSelectModel={(m) => setActiveModel(m)}
            onSendToTerminal={(cmd) => {
              setActiveTab("terminal");
            }}
          />
        )}

        {/* TAB 3: RUST SOURCE CODE VIEWER & ZIP EXPORTER */}
        {activeTab === "code" && <RustCodeViewer />}

        {/* TAB 4: CLI COMMAND BUILDER */}
        {activeTab === "builder" && (
          <CliCommandBuilder
            currentModel={activeModel}
            onExecuteCommand={(cmd) => {
              setActiveTab("terminal");
            }}
          />
        )}

        {/* TAB 5: OFFLINE GUIDE & DOCUMENTATION */}
        {activeTab === "docs" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6 text-sm text-slate-300">
            <div className="space-y-2 pb-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span>Offline LLM & Straight Weights Guide</span>
              </h2>
              <p className="text-xs text-slate-400">
                Why a standalone Rust downloader is needed and how to use downloaded weights in offline environments.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Problem vs Solution */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-rose-400">❌ The Default Python / Hugging Face Problem</h3>
                <ul className="text-xs space-y-2 text-slate-400 list-disc list-inside">
                  <li>Creates <code className="text-slate-300 font-mono">~/.cache/huggingface/hub/models--.../blobs/...</code> and symlinks them into snapshots.</li>
                  <li>Copying to USB drives or network drives breaks all relative symlinks.</li>
                  <li>Windows systems without Developer Mode fail to create symlinks.</li>
                  <li>Requires heavy Python environment, PyTorch, and huggingface_hub libraries.</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-emerald-400">✔ The Rust `hf-pull` Solution</h3>
                <ul className="text-xs space-y-2 text-slate-400 list-disc list-inside">
                  <li>Single standalone binary (~4MB) with zero Python dependencies.</li>
                  <li>Downloads straight byte files (<code className="text-slate-300 font-mono">model.safetensors</code>, <code className="text-slate-300 font-mono">config.json</code>) directly into your chosen folder.</li>
                  <li>100% portable for air-gapped servers, offline rigs, and USB drives.</li>
                  <li>Fast chunked streaming with automatic range resume and SHA-256 validation.</li>
                </ul>
              </div>
            </div>

            {/* How to run with popular inference engines */}
            <div className="space-y-4 pt-2">
              <h3 className="text-base font-bold text-slate-100">Using Downloaded Straight Weights:</h3>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="text-amber-400 font-bold block mb-1"># 1. Download model with hf-pull</span>
                  <span className="text-slate-300 select-all block">hf-pull unsloth/Qwen3.8-27B-NVFP4 --output-dir ./qwen_weights</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="text-cyan-400 font-bold block mb-1"># 2. Run with vLLM (Offline)</span>
                  <span className="text-slate-300 select-all block">vllm serve ./qwen_weights --port 8000</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                  <span className="text-purple-400 font-bold block mb-1"># 3. Load with Hugging Face Transformers (Python offline)</span>
                  <span className="text-slate-300 select-all block">from transformers import AutoModelForCausalLM, AutoTokenizer<br />model = AutoModelForCausalLM.from_pretrained("./qwen_weights", local_files_only=True)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Rust Standalone HuggingFace Weights Downloader • Built for offline high-performance LLM deployment</span>
          <span className="font-mono text-[11px] text-amber-400/80">cargo build --release</span>
        </div>
      </footer>
    </div>
  );
}
