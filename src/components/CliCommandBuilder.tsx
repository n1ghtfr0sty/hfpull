import React, { useState } from "react";
import { CliOptions } from "../types";
import { Sliders, Copy, Check, Play, Terminal, Shield, ArrowRight, Folder, Hash } from "lucide-react";

interface CliCommandBuilderProps {
  currentModel: string;
  onExecuteCommand: (cmd: string) => void;
}

export const CliCommandBuilder: React.FC<CliCommandBuilderProps> = ({
  currentModel,
  onExecuteCommand,
}) => {
  const [options, setOptions] = useState<CliOptions>({
    model: currentModel || "unsloth/Qwen3.8-27B-NVFP4",
    outputDir: "./models",
    token: "",
    revision: "main",
    threads: 8,
    filter: "*.safetensors,*.json",
    exclude: "",
    verify: true,
    resume: true,
    skipExisting: true,
    flat: false,
  });

  const [copied, setCopied] = useState<boolean>(false);

  // Sync if currentModel changes from parent
  React.useEffect(() => {
    if (currentModel) {
      setOptions((prev) => ({ ...prev, model: currentModel }));
    }
  }, [currentModel]);

  const generateCommand = () => {
    const parts = ["hf-pull", options.model];

    if (options.outputDir && options.outputDir !== `./${options.model.replace("/", "_")}`) {
      parts.push(`-o ${options.outputDir}`);
    }

    if (options.threads !== 4) {
      parts.push(`-j ${options.threads}`);
    }

    if (options.revision && options.revision !== "main") {
      parts.push(`-r ${options.revision}`);
    }

    if (options.filter) {
      parts.push(`-f "${options.filter}"`);
    }

    if (options.exclude) {
      parts.push(`-e "${options.exclude}"`);
    }

    if (options.token) {
      parts.push(`-t ${options.token}`);
    }

    if (!options.verify) {
      parts.push(`--verify=false`);
    }

    if (!options.resume) {
      parts.push(`--resume=false`);
    }

    if (options.flat) {
      parts.push(`--flat`);
    }

    return parts.join(" ");
  };

  const commandString = generateCommand();

  const copyCommand = () => {
    navigator.clipboard.writeText(commandString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="cli-command-builder-root" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">CLI Command Generator & Options</h2>
          </div>
          <p className="text-xs text-slate-400">
            Configure download flags, multi-threading, custom destination paths, and file filters
          </p>
        </div>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Model ID */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center justify-between">
            <span>Model Repository (hfname)</span>
            <span className="text-amber-400 font-mono">positional</span>
          </label>
          <input
            id="builder-model-input"
            type="text"
            value={options.model}
            onChange={(e) => setOptions({ ...options, model: e.target.value })}
            placeholder="e.g. unsloth/Qwen3.8-27B-NVFP4"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Output Directory */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center justify-between">
            <span>Destination Folder (-o)</span>
            <span className="text-slate-500 font-mono">--output-dir</span>
          </label>
          <input
            id="builder-output-dir-input"
            type="text"
            value={options.outputDir}
            onChange={(e) => setOptions({ ...options, outputDir: e.target.value })}
            placeholder="./models or /mnt/weights"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Worker Threads Slider */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center justify-between">
            <span>Parallel Workers (-j)</span>
            <span className="text-amber-400 font-mono font-bold">{options.threads} threads</span>
          </label>
          <div className="flex items-center gap-3 pt-1">
            <input
              id="builder-threads-slider"
              type="range"
              min={1}
              max={16}
              step={1}
              value={options.threads}
              onChange={(e) => setOptions({ ...options, threads: parseInt(e.target.value, 10) })}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
            <span className="w-6 text-right font-mono text-slate-300">{options.threads}</span>
          </div>
        </div>

        {/* File Filter */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center justify-between">
            <span>Include Pattern (-f)</span>
            <span className="text-slate-500 font-mono">--filter</span>
          </label>
          <input
            id="builder-filter-input"
            type="text"
            value={options.filter}
            onChange={(e) => setOptions({ ...options, filter: e.target.value })}
            placeholder="*.safetensors,*.json"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Exclude Filter */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center justify-between">
            <span>Exclude Pattern (-e)</span>
            <span className="text-slate-500 font-mono">--exclude</span>
          </label>
          <input
            id="builder-exclude-input"
            type="text"
            value={options.exclude}
            onChange={(e) => setOptions({ ...options, exclude: e.target.value })}
            placeholder="*.bin,*.msgpack,*.onnx"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* HF Token */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center justify-between">
            <span>HF Token (-t)</span>
            <span className="text-slate-500 font-mono">$HF_TOKEN</span>
          </label>
          <input
            id="builder-token-input"
            type="password"
            value={options.token}
            onChange={(e) => setOptions({ ...options, token: e.target.value })}
            placeholder="hf_..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Boolean Toggles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
        <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.verify}
            onChange={(e) => setOptions({ ...options, verify: e.target.checked })}
            className="accent-amber-500 rounded"
          />
          <span>Verify SHA-256</span>
        </label>

        <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.resume}
            onChange={(e) => setOptions({ ...options, resume: e.target.checked })}
            className="accent-amber-500 rounded"
          />
          <span>Resume (.part)</span>
        </label>

        <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.skipExisting}
            onChange={(e) => setOptions({ ...options, skipExisting: e.target.checked })}
            className="accent-amber-500 rounded"
          />
          <span>Skip Existing</span>
        </label>

        <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.flat}
            onChange={(e) => setOptions({ ...options, flat: e.target.checked })}
            className="accent-amber-500 rounded"
          />
          <span>Flatten Folder</span>
        </label>
      </div>

      {/* Generated CLI Output Box */}
      <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Generated Rust Terminal Command</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              id="copy-command-btn"
              onClick={copyCommand}
              className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              id="run-in-terminal-btn"
              onClick={() => onExecuteCommand(commandString)}
              className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition-colors shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run in Terminal</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-lg font-mono text-xs sm:text-sm text-emerald-400 select-all overflow-x-auto border border-slate-800">
          {commandString}
        </div>
      </div>
    </div>
  );
};
