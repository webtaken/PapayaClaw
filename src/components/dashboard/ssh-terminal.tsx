"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { io, Socket } from "socket.io-client";
import { Loader2, Terminal as TerminalIcon } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export function SshTerminal({ instanceId }: { instanceId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#09090b", // zinc-950
        foreground: "#f4f4f5", // zinc-100
        cursor: "#a855f7", // purple-500
        selectionBackground: "rgba(168, 85, 247, 0.3)",
        black: "#000000",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#d946ef",
        cyan: "#06b6d4",
        white: "#ffffff",
      },
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 14,
      scrollback: 1000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);

    // Slight delay to ensure parent container layout is settled before fitting
    setTimeout(() => {
      fitAddon.fit();
    }, 10);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[36mInitializing connection...\x1b[0m");

    // Connect socket — use polling only because Next.js API routes
    // don't support WebSocket upgrades natively
    const socket = io({
      path: "/api/socketio",
      transports: ["polling"],
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);
      term.writeln(
        "\r\n\x1b[32mSocket connected. Authenticating...\x1b[0m\r\n",
      );
      socket.emit("init", { instanceId });
    });

    socket.on("connect_error", (err) => {
      setError("Socket connection failed.");
      term.writeln(
        `\r\n\x1b[31mSocket connection error: ${err.message}\x1b[0m\r\n`,
      );
    });

    socket.on("ready", () => {
      term.clear();
      // Inform the backend about terminal size
      socket.emit("resize", { cols: term.cols, rows: term.rows });
    });

    socket.on("data", (data: string) => {
      term.write(data);
    });

    socket.on("error", (err: string) => {
      term.writeln(`\r\n\x1b[31m${err}\x1b[0m\r\n`);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      term.writeln("\r\n\x1b[33mDisconnected from server.\x1b[0m\r\n");
    });

    term.onData((data) => {
      if (socket.connected) {
        socket.emit("data", data);
      }
    });

    term.onResize(({ cols, rows }) => {
      if (socket.connected) {
        socket.emit("resize", { cols, rows });
      }
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, [instanceId]);

  return (
    <div className="flex h-full min-h-[400px] w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TerminalIcon className="-mt-px h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Console</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`relative flex h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-zinc-500"}`}
            >
              {isConnected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              )}
            </span>
            <span className={isConnected ? "text-zinc-300" : "text-zinc-500"}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal View area */}
      <div className="relative flex-1 p-2 pb-0">
        {!isConnected && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              Connecting...
            </div>
          </div>
        )}
        {/* We need xterm to fill its container so we specify h-full w-full */}
        <div
          ref={terminalRef}
          className="h-full w-full [&_.xterm-viewport]:scrollbar-thin [&_.xterm-viewport]:scrollbar-track-transparent [&_.xterm-viewport]:scrollbar-thumb-zinc-700"
        />
      </div>
    </div>
  );
}
