import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

type KnowledgeLiveEvent =
  | { type: "ready"; ts: string }
  | { type: "tick"; ts: string };

const WS_PATH = "/knowledge/graph/live";
const TICK_MS = 5_000;

export class KnowledgeLiveService {
  private wss: WebSocketServer | null = null;
  private tickTimer: NodeJS.Timeout | null = null;

  attach(server: HttpServer): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (socket: WebSocket) => {
      this.send(socket, { type: "ready", ts: new Date().toISOString() });
    });

    server.on("upgrade", (request, socket, head) => {
      if (!this.isLivePath(request)) {
        return;
      }
      this.wss?.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        this.wss?.emit("connection", ws, request);
      });
    });

    this.tickTimer = setInterval(() => {
      this.broadcast({ type: "tick", ts: new Date().toISOString() });
    }, TICK_MS);

    server.on("close", () => this.shutdown());
  }

  shutdown(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.wss) {
      this.wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      this.wss.close();
      this.wss = null;
    }
  }

  private broadcast(event: KnowledgeLiveEvent): void {
    const message = JSON.stringify(event);
    this.wss?.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private send(socket: WebSocket, event: KnowledgeLiveEvent): void {
    socket.send(JSON.stringify(event));
  }

  private isLivePath(request: IncomingMessage): boolean {
    const url = request.url ?? "";
    const path = url.split("?")[0] ?? "";
    return path === WS_PATH;
  }
}
