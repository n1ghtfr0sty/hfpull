import React, { useState, useEffect, useRef } from "react";
import { TerminalLogEntry, HfModelInfo, HfFile } from "../types";
import { Play, RotateCcw, Copy, Check, Terminal as TerminalIcon, Sparkles, Download, ShieldCheck, Cpu } from "lucide-react";

interface TerminalSimulatorProps {
  initialModel?: string;
  onSelectModel?: (model: string) => void;
  onOpenCode?: () => void;
}

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({
  initialModel = "unsloth/Qwen3.8-27B-NVFP4",
  onSelectModel,
  onOpenCode,
}) => {
  const [logs, setLogs] = useState<TerminalLogEntry[]>([]);
  const [inputVal, setInputVal] = useState<string>(`hf-pull ${initialModel} --output-dir ./models`);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Initial welcome message
  useEffect(() => {
    setLogs([
      {
        id: "banner-1",
        type: "stdout",
        text: "=========================================================",
        timestamp: "00:00:00",
      },
      {
        id: "banner-2",
        type: "stdout",
        text: "  ██╗  ██╗███████╗   ██████╗ ██╗   ██╗██╗     ██╗     \n  ██║  ██║██╔════╝   ██╔══██╗██║   ██║██║     ██║     \n  ███████║█████╗     ██████╔╝██║   ██║██║     ██║     \n  ██╔══██║██╔══╝     ██╔═══╝ ██║   ██║██║     ██║     \n  ██║  ██║██║        ██║     ╚██████╔╝███████╗███████╗\n  ╚═╝  ╚═╝╚═╝        ╚═╝      ╚═════╝ ╚══════╝╚══════╝",
        timestamp: "00:00:00",
      },
      {
        id: "banner-3",
        type: "info",
        text: "  hf-pull v0.1.0 (Rust Standalone HuggingFace Weight Downloader)\n  Straight weights without symlinks or cache wrappers for offline LLMs.",
        timestamp: "00:00:00",
      },
      {
        id: "banner-4",
        type: "stdout",
        text: "=========================================================",
        timestamp: "00:00:00",
      },
      {
        id: "init-tip",
        type: "stdout",
        text: 'Type "hf-pull <model>" or "help" to start. Press [Run] or Enter.',
        timestamp: "00:00:00",
      },
    ]);
  }, []);

  const addLog = (entry: Omit<TerminalLogEntry, "id" | "timestamp">) => {
    const newEntry: TerminalLogEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev, newEntry]);
    return newEntry.id;
  };

  const handleCommand = async (cmdStr: string) => {
    const raw = cmdStr.trim();
    if (!raw) return;

    // Add to history
    setHistory((prev) => [...prev, raw]);
    setHistoryIndex(-1);

    addLog({ type: "input", text: raw });
    setIsRunning(true);

    const parts = raw.split(" ").filter(Boolean);
    const mainCmd = parts[0]?.toLowerCase();

    if (mainCmd === "clear" || mainCmd === "cls") {
      setLogs([]);
      setIsRunning(false);
      return;
    }

    if (mainCmd === "help") {
      addLog({
        type: "info",
        text: `hf-pull - Rust Standalone Model Weights Downloader

USAGE:
    hf-pull <MODEL_ID> [OPTIONS]
    hf-pull unsloth/Qwen3.8-27B-NVFP4 -o ./models -j 8

ARGUMENTS:
    <MODEL_ID>           HuggingFace model repository (e.g. unsloth/Qwen3.8-27B-NVFP4)

OPTIONS:
    -o, --output-dir     Target directory to save straight weights into (default: ./<repo>)
    -t, --token          HuggingFace token for gated/private models
    -j, --threads        Number of concurrent download workers (default: 4)
    -r, --revision       Git branch or tag (default: main)
    -f, --filter         Filter files (e.g. '*.safetensors,*.json')
    -e, --exclude        Exclude files (e.g. '*.bin,*.onnx')
    -v, --verify         Verify streaming SHA-256 checksums (default: true)
    -c, --resume         Resume partial .part downloads (default: true)
    --tree-only          Display file tree without downloading
    --flat               Flatten directory tree

OTHER COMMANDS:
    inspect <model>      Query HuggingFace API for real file details
    cargo build          Simulate compilation of Rust binary
    export               View Rust project source files
    clear                Clear terminal screen`,
      });
      setIsRunning(false);
      return;
    }

    if (mainCmd === "cargo" && parts[1] === "build") {
      addLog({ type: "info", text: "   Compiling hf-pull v0.1.0 (/rust_project)" });
      await new Promise((r) => setTimeout(r, 600));
      addLog({ type: "info", text: "   Compiling reqwest v0.12.7 (rustls-tls, stream)" });
      addLog({ type: "info", text: "   Compiling indicatif v0.17.8" });
      addLog({ type: "info", text: "   Compiling tokio v1.39.2 (full)" });
      await new Promise((r) => setTimeout(r, 800));
      addLog({
        type: "success",
        text: "    Finished release [optimized + lto] target(s) in 1.42s\n    Binary ready: target/release/hf-pull",
      });
      setIsRunning(false);
      return;
    }

    if (mainCmd === "export") {
      addLog({ type: "info", text: "Opening Rust source code explorer..." });
      onOpenCode?.();
      setIsRunning(false);
      return;
    }

    if (mainCmd === "inspect") {
      const targetModel = parts[1] || initialModel;
      await runInspectModel(targetModel);
      setIsRunning(false);
      return;
    }

    if (mainCmd === "hf-pull" || mainCmd === "hf-get" || mainCmd === "hf_pull" || mainCmd === "./hf-pull") {
      let model = "";
      let outputDir = "";
      let threads = 4;
      let filter = "";
      let token = "";
      let treeOnly = false;
      let revision = "main";
      let verify = true;

      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        if (p === "-o" || p === "--output-dir") {
          outputDir = parts[++i] || "";
        } else if (p === "-j" || p === "--threads") {
          threads = parseInt(parts[++i] || "4", 10) || 4;
        } else if (p === "-f" || p === "--filter") {
          filter = parts[++i] || "";
        } else if (p === "-t" || p === "--token") {
          token = parts[++i] || "";
        } else if (p === "-r" || p === "--revision") {
          revision = parts[++i] || "main";
        } else if (p === "--tree-only") {
          treeOnly = true;
        } else if (p === "-v" || p === "--verify") {
          verify = true;
        } else if (!p.startsWith("-") && !model) {
          model = p;
        }
      }

      if (!model) {
        model = initialModel;
      }

      if (!outputDir) {
        outputDir = `./${model.replace("/", "_")}`;
      }

      await executeDownloadRun({ model, outputDir, threads, filter, token, treeOnly, revision, verify });
      setIsRunning(false);
      return;
    }

    addLog({
      type: "stderr",
      text: `error: command not found: "${mainCmd}". Type "help" or run: hf-pull unsloth/Qwen3.8-27B-NVFP4`,
    });
    setIsRunning(false);
  };

  const runInspectModel = async (model: string) => {
    addLog({ type: "info", text: `✦ Querying Hugging Face API for metadata: ${model}...` });
    try {
      const resp = await fetch(`/api/hf/model?model=${encodeURIComponent(model)}`);
      if (!resp.ok) {
        throw new Error(`API error ${resp.status}`);
      }
      const data: HfModelInfo = await resp.json();
      addLog({
        type: "success",
        text: `✔ Model Found: ${data.modelId}
  • Pipeline Tag:  ${data.pipeline_tag}
  • Total Files:   ${data.totalFiles} files
  • Total Size:    ${(data.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
  • Gated / Auth:  ${data.gated ? "YES (Token Required)" : "Public (No Token Required)"}`,
      });
    } catch (err: any) {
      addLog({ type: "stderr", text: `Failed to inspect model: ${err.message}` });
    }
  };

  const executeDownloadRun = async (params: {
    model: string;
    outputDir: string;
    threads: number;
    filter: string;
    token: string;
    treeOnly: boolean;
    revision: string;
    verify: boolean;
  }) => {
    addLog({
      type: "info",
      text: `✦ Target Model : ${params.model}\n✦ Destination  : ${params.outputDir}\n✦ Revision     : ${params.revision}\n✦ Workers      : ${params.threads} threads\n✦ Verification: SHA-256 streaming enabled`,
    });

    addLog({ type: "stdout", text: "→ Querying HuggingFace API for repository tree..." });

    let modelData: HfModelInfo | null = null;
    try {
      const resp = await fetch(`/api/hf/model?model=${encodeURIComponent(params.model)}&token=${encodeURIComponent(params.token)}&revision=${encodeURIComponent(params.revision)}`);
      if (resp.ok) {
        modelData = await resp.json();
      }
    } catch (e) {
      // ignore
    }

    // Default mock data if offline or rate limited
    const files: HfFile[] = modelData?.files && modelData.files.length > 0
      ? modelData.files
      : [
          { path: "config.json", size: 780, lfs: false, directUrl: `https://huggingface.co/${params.model}/resolve/main/config.json` },
          { path: "generation_config.json", size: 242, lfs: false, directUrl: `https://huggingface.co/${params.model}/resolve/main/generation_config.json` },
          { path: "model.safetensors.index.json", size: 45210, lfs: false, directUrl: `https://huggingface.co/${params.model}/resolve/main/model.safetensors.index.json` },
          { path: "model-00001-of-00004.safetensors", size: 4890000000, lfs: true, sha256: "8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f", directUrl: `https://huggingface.co/${params.model}/resolve/main/model-00001-of-00004.safetensors` },
          { path: "model-00002-of-00004.safetensors", size: 4950000000, lfs: true, sha256: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b", directUrl: `https://huggingface.co/${params.model}/resolve/main/model-00002-of-00004.safetensors` },
          { path: "model-00003-of-00004.safetensors", size: 4920000000, lfs: true, sha256: "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d", directUrl: `https://huggingface.co/${params.model}/resolve/main/model-00003-of-00004.safetensors` },
          { path: "model-00004-of-00004.safetensors", size: 3410000000, lfs: true, sha256: "5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f", directUrl: `https://huggingface.co/${params.model}/resolve/main/model-00004-of-00004.safetensors` },
          { path: "tokenizer.json", size: 7034000, lfs: true, sha256: "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b", directUrl: `https://huggingface.co/${params.model}/resolve/main/tokenizer.json` },
          { path: "tokenizer_config.json", size: 7280, lfs: false, directUrl: `https://huggingface.co/${params.model}/resolve/main/tokenizer_config.json` },
        ];

    // Filter files
    let filteredFiles = files;
    if (params.filter) {
      const filters = params.filter.split(",").map((s) => s.trim().toLowerCase());
      filteredFiles = files.filter((f) =>
        filters.some((filt) => {
          const cleanFilt = filt.replace("*", "");
          return f.path.toLowerCase().includes(cleanFilt);
        })
      );
    }

    const totalBytes = filteredFiles.reduce((acc, f) => acc + f.size, 0);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    addLog({
      type: "success",
      text: `✔ Found ${filteredFiles.length} matching files (${totalGB} GB total straight weights)`,
    });

    if (params.treeOnly) {
      addLog({
        type: "table",
        tableData: {
          headers: ["File Path", "Size", "LFS SHA-256", "Direct URL (No Symlinks)"],
          rows: filteredFiles.map((f) => [
            f.path,
            formatSize(f.size),
            f.sha256 ? `${f.sha256.substring(0, 12)}...` : "Direct Git",
            f.directUrl,
          ]),
        },
      });
      return;
    }

    addLog({
      type: "info",
      text: `🚀 Starting ${params.threads} async worker threads downloading straight to ${params.outputDir}...`,
    });

    // Simulate multi-file parallel download progression with real calculations
    const progressEntryId = addLog({
      type: "progress",
      progressData: {
        totalBytes,
        downloadedBytes: 0,
        speedBytesPerSec: 0,
        files: filteredFiles.slice(0, 8).map((f, idx) => ({
          path: f.path,
          downloaded: 0,
          total: f.size,
          status: "pending",
          workerId: (idx % params.threads) + 1,
          speed: "0 MB/s",
        })),
      },
    });

    // Step-by-step animation
    let downloaded = 0;
    const steps = 12;
    for (let step = 1; step <= steps; step++) {
      await new Promise((r) => setTimeout(r, 260));
      downloaded = Math.min(totalBytes, (totalBytes * step) / steps);
      const simulatedSpeed = 85 + Math.sin(step) * 22; // MB/s

      setLogs((prev) =>
        prev.map((item) => {
          if (item.id === progressEntryId && item.progressData) {
            return {
              ...item,
              progressData: {
                ...item.progressData,
                downloadedBytes: downloaded,
                speedBytesPerSec: simulatedSpeed * 1024 * 1024,
                files: item.progressData.files.map((fileState, idx) => {
                  const fileProgressRatio = Math.min(1, (step * (idx + 1.2)) / steps);
                  const fileDown = Math.floor(fileState.total * fileProgressRatio);
                  const status =
                    fileProgressRatio >= 1
                      ? "completed"
                      : fileProgressRatio > 0.05
                      ? "downloading"
                      : "pending";
                  return {
                    ...fileState,
                    downloaded: fileDown,
                    status,
                    speed: `${(simulatedSpeed / params.threads).toFixed(1)} MB/s`,
                  };
                }),
              },
            };
          }
          return item;
        })
      );
    }

    // Verification check
    if (params.verify) {
      await new Promise((r) => setTimeout(r, 300));
      addLog({
        type: "success",
        text: `✔ SHA-256 Checksums verified for all ${filteredFiles.length} files against Hugging Face Git LFS metadata.`,
      });
    }

    addLog({
      type: "stdout",
      text: "======================================================================",
    });
    addLog({
      type: "success",
      text: `✔ COMPLETED: Model weights successfully downloaded!
  • Location: ${params.outputDir}
  • Total Size: ${totalGB} GB
  • Files: ${filteredFiles.length} files
  • Weights: Direct pure byte files (ready for llama.cpp, vLLM, transformers, Ollama offline)`,
    });
    addLog({
      type: "stdout",
      text: "======================================================================",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  const copyTerminalLogs = () => {
    const text = logs
      .map((l) => (l.text ? l.text : `[Progress: ${l.progressData?.downloadedBytes || 0} bytes]`))
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="terminal-simulator-root" className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden font-mono text-sm">
      {/* Terminal Titlebar */}
      <div id="terminal-titlebar" className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 cursor-pointer" />
          </div>
          <div className="flex items-center space-x-2 pl-3 text-xs font-semibold text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>hf-pull — bash terminal / offline weights downloader</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick preset buttons */}
          <button
            id="preset-qwen"
            onClick={() => {
              setInputVal("hf-pull unsloth/Qwen3.8-27B-NVFP4 -o ./models -j 8");
              onSelectModel?.("unsloth/Qwen3.8-27B-NVFP4");
            }}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors border border-slate-700"
          >
            Qwen3.8-27B
          </button>
          <button
            id="preset-deepseek"
            onClick={() => {
              setInputVal("hf-pull deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B -o ./models");
              onSelectModel?.("deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B");
            }}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors border border-slate-700"
          >
            DeepSeek-R1
          </button>
          <button
            id="copy-terminal-btn"
            onClick={copyTerminalLogs}
            title="Copy Terminal Output"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            id="clear-terminal-btn"
            onClick={() => setLogs([])}
            title="Clear Screen"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Screen Body */}
      <div id="terminal-body" className="flex-1 p-4 overflow-y-auto space-y-2.5 bg-slate-950/95 leading-relaxed selection:bg-amber-500/30 selection:text-amber-200">
        {logs.map((log) => {
          if (log.type === "input") {
            return (
              <div key={log.id} className="flex items-center space-x-2 text-emerald-400 font-bold">
                <span className="text-amber-400 select-none">user@local:~/models$</span>
                <span>{log.text}</span>
              </div>
            );
          }

          if (log.type === "progress" && log.progressData) {
            const { totalBytes, downloadedBytes, speedBytesPerSec, files } = log.progressData;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
            const downGB = (downloadedBytes / (1024 * 1024 * 1024)).toFixed(2);
            const speedMB = (speedBytesPerSec / (1024 * 1024)).toFixed(1);

            return (
              <div key={log.id} className="my-3 p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/90 text-xs space-y-3">
                {/* Overall Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-cyan-300">Overall Progress ({percent}%)</span>
                    </div>
                    <div className="flex items-center space-x-3 text-slate-400">
                      <span>{downGB} / {totalGB} GB</span>
                      <span className="text-emerald-400 font-bold">{speedMB} MB/s</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Per-Worker File Streams */}
                <div className="space-y-1 pt-1 border-t border-slate-800/60">
                  <div className="text-[11px] text-slate-400 font-semibold mb-1 flex items-center justify-between">
                    <span>Active Worker Streams:</span>
                    <span>Direct byte streaming to disk (.part)</span>
                  </div>
                  {files.map((file, idx) => {
                    const filePct = file.total > 0 ? Math.min(100, Math.round((file.downloaded / file.total) * 100)) : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-slate-950/60 font-mono text-[11px]">
                        <div className="flex items-center space-x-2 truncate max-w-[45%]">
                          <span className="text-amber-400 text-[10px] px-1 bg-amber-950/80 rounded border border-amber-800/40">
                            W#{file.workerId}
                          </span>
                          <span className="truncate text-slate-200">{file.path}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-slate-400">
                          <span className="w-12 text-right">{filePct}%</span>
                          <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${file.status === "completed" ? "bg-emerald-400" : "bg-amber-400"}`}
                              style={{ width: `${filePct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-slate-300">
                            {formatSize(file.downloaded)}
                          </span>
                          <span className={`w-20 text-right ${file.status === "completed" ? "text-emerald-400" : "text-amber-300"}`}>
                            {file.status === "completed" ? "✔ Done" : file.speed}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (log.type === "table" && log.tableData) {
            return (
              <div key={log.id} className="my-2 overflow-x-auto rounded border border-slate-800 bg-slate-900/60 p-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      {log.tableData.headers.map((h, i) => (
                        <th key={i} className="py-1 px-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.tableData.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-800/50 hover:bg-slate-800/40 text-slate-300">
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-1 px-2 font-mono text-[11px] truncate max-w-[200px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <div
              key={log.id}
              className={`whitespace-pre-wrap ${
                log.type === "stderr"
                  ? "text-rose-400 font-semibold"
                  : log.type === "success"
                  ? "text-emerald-300"
                  : log.type === "info"
                  ? "text-cyan-300"
                  : log.type === "warning"
                  ? "text-amber-300"
                  : "text-slate-300"
              }`}
            >
              {log.text}
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <form
        id="terminal-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isRunning) {
            handleCommand(inputVal);
          }
        }}
        className="flex items-center px-4 py-3 bg-slate-900 border-t border-slate-800 gap-3"
      >
        <span className="text-amber-400 font-bold select-none text-xs sm:text-sm">
          user@local:~/models$
        </span>
        <input
          ref={inputRef}
          id="terminal-cli-input"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              if (history.length > 0) {
                const nextIdx = historyIndex + 1 < history.length ? historyIndex + 1 : historyIndex;
                setHistoryIndex(nextIdx);
                setInputVal(history[history.length - 1 - nextIdx] || "");
              }
            } else if (e.key === "ArrowDown") {
              if (historyIndex > 0) {
                const nextIdx = historyIndex - 1;
                setHistoryIndex(nextIdx);
                setInputVal(history[history.length - 1 - nextIdx] || "");
              } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInputVal("");
              }
            }
          }}
          disabled={isRunning}
          placeholder="e.g. hf-pull unsloth/Qwen3.8-27B-NVFP4 --output-dir ./models"
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-sm disabled:opacity-50"
        />
        <button
          id="terminal-execute-btn"
          type="submit"
          disabled={isRunning || !inputVal.trim()}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          {isRunning ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
