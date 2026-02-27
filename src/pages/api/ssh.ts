import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { Client as SSHClient } from "ssh2";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.io) {
    console.log("[Socket.IO] Starting Socket.IO Server on /api/ssh...");
    const path = "/api/socketio";
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path,
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.use(async (socket, next) => {
      try {
        const headers = new Headers();
        Object.entries(socket.request.headers).forEach(([k, v]) => {
          if (typeof v === "string") headers.append(k, v);
          else if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
        });

        const session = await auth.api.getSession({ headers });
        if (!session) {
          return next(new Error("Unauthorized"));
        }

        socket.data.user = session.user;
        next();
      } catch (error) {
        console.error("[Socket.IO] Auth Error:", error);
        next(new Error("Authentication failed"));
      }
    });

    io.on("connection", (socket) => {
      console.log("[Socket.IO] Connected client:", socket.id);
      let sshConn: SSHClient | null = null;
      let sshStream: any = null;

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
                  .on("data", (data: any) => {
                    socket.emit("data", data.toString("utf-8"));
                  })
                  .stderr.on("data", (data: any) => {
                    socket.emit("data", data.toString("utf-8"));
                  });
              });
            })
            .on("error", (err) => {
              if (err.message.includes("ECONNREFUSED")) {
                socket.emit(
                  "error",
                  "\r\nSSH connection refused. Server may be booting up.\r\n",
                );
              } else {
                socket.emit(
                  "error",
                  "\r\nSSH connection error: " + err.message + "\r\n",
                );
              }
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
          console.error("[Socket.IO] Init Error:", error);
          socket.emit("error", "\r\nInternal error: " + error.message + "\r\n");
          socket.disconnect();
        }
      });

      socket.on("data", (data: string) => {
        if (sshStream) {
          sshStream.write(data);
        }
      });

      socket.on("resize", ({ cols, rows }: { cols: number; rows: number }) => {
        if (sshStream) {
          sshStream.setWindow(rows, cols, 0, 0);
        }
      });

      socket.on("disconnect", () => {
        console.log("[Socket.IO] Disconnected client:", socket.id);
        if (sshStream) sshStream.end();
        if (sshConn) sshConn.end();
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}
