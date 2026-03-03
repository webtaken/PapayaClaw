/**
 * Custom Node.js HTTP server that wraps Next.js and attaches Socket.IO
 * for the SSH terminal feature.
 *
 * Why: Next.js API routes (both App Router and Pages Router) cannot
 * reliably hold long-lived WebSocket connections. A custom server
 * attaches Socket.IO at the HTTP layer, so WebSocket upgrades just work.
 *
 * Usage:   tsx server.mts          (dev)
 *          node --import tsx server.mts  (prod, after `next build`)
 */

import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { Client as SSHClient } from "ssh2";
import { db } from "./src/lib/db.js";
import { instance } from "./src/lib/schema.js";
import { auth } from "./src/lib/auth.js";
import { eq, and } from "drizzle-orm";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // ── Socket.IO ──────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    path: "/api/ssh",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Auth middleware — validate better-auth session from cookies
  io.use(async (socket, next) => {
    try {
      const headers = new Headers();
      const raw = socket.request.headers;
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") headers.append(k, v);
        else if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
      }

      const session = await auth.api.getSession({ headers });
      if (!session) return next(new Error("Unauthorized"));

      socket.data.user = session.user;
      next();
    } catch (error) {
      console.error("[Socket.IO] Auth error:", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log("[SSH] Client connected:", socket.id);
    let sshConn: SSHClient | null = null;
    let sshStream: ReturnType<SSHClient["shell"]> extends void ? never : any =
      null;

    socket.on("init", async ({ instanceId }: { instanceId: string }) => {
      try {
        const user = socket.data.user;
        const [inst] = await db
          .select()
          .from(instance)
          .where(
            and(eq(instance.id, instanceId), eq(instance.userId, user.id)),
          );

        if (!inst) {
          socket.emit("error", "Instance not found or unauthorized");
          socket.disconnect();
          return;
        }

        if (!inst.providerServerIp || !inst.sshPrivateKey) {
          socket.emit(
            "error",
            "\r\nInstance is not ready for SSH connection.\r\n",
          );
          socket.disconnect();
          return;
        }

        socket.emit(
          "data",
          `\r\nConnecting to root@${inst.providerServerIp}...\r\n`,
        );

        sshConn = new SSHClient();

        sshConn
          .on("ready", () => {
            sshConn!.shell((err, stream) => {
              if (err) {
                socket.emit(
                  "error",
                  "\r\nSSH shell error: " + err.message + "\r\n",
                );
                socket.disconnect();
                return;
              }
              sshStream = stream;
              socket.emit("ready");

              stream
                .on("close", () => {
                  socket.emit("data", "\r\n[Connection closed]\r\n");
                  socket.disconnect();
                })
                .on("data", (data: Buffer) => {
                  socket.emit("data", data.toString("utf-8"));
                })
                .stderr.on("data", (data: Buffer) => {
                  socket.emit("data", data.toString("utf-8"));
                });
            });
          })
          .on("error", (err) => {
            const msg = err.message.includes("ECONNREFUSED")
              ? "\r\nSSH connection refused. Server may be booting up.\r\n"
              : "\r\nSSH connection error: " + err.message + "\r\n";
            socket.emit("error", msg);
            socket.disconnect();
          })
          .connect({
            host: inst.providerServerIp,
            port: 22,
            username: "root",
            privateKey: inst.sshPrivateKey,
            readyTimeout: 10000,
          });
      } catch (error: any) {
        console.error("[SSH] Init error:", error);
        socket.emit("error", "\r\nInternal error: " + error.message + "\r\n");
        socket.disconnect();
      }
    });

    socket.on("data", (data: string) => {
      if (sshStream) sshStream.write(data);
    });

    socket.on("resize", ({ cols, rows }: { cols: number; rows: number }) => {
      if (sshStream) sshStream.setWindow(rows, cols, 0, 0);
    });

    socket.on("disconnect", () => {
      console.log("[SSH] Client disconnected:", socket.id);
      if (sshStream) sshStream.end();
      if (sshConn) sshConn.end();
    });
  });

  // ── Start ──────────────────────────────────────────────────────────
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
