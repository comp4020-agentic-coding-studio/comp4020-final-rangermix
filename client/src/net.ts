import type { ClientMsg } from "./protocol/ClientMsg";
import type { ServerMsg } from "./protocol/ServerMsg";

export type Status = "connecting" | "open" | "closed";

/** One WebSocket to /ws. It reconnects on its own, waiting 0.5 s and doubling to 5 s, until stopped. */
export class Connection {
  private ws: WebSocket | null = null;
  private delay = 500;
  private stopped = false;
  private timer: number | undefined;

  constructor(
    private readonly onMessage: (msg: ServerMsg) => void,
    private readonly onStatus: (status: Status) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.isOpen()) this.ws.send(JSON.stringify(msg));
  }

  private open(): void {
    this.onStatus("connecting");
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.delay = 500;
      this.onStatus("open");
    };
    ws.onmessage = (event) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(event.data)) as ServerMsg;
      } catch {
        return;
      }
      this.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onStatus("closed");
      if (this.stopped) return;
      this.timer = window.setTimeout(() => this.open(), this.delay);
      this.delay = Math.min(this.delay * 2, 5000);
    };
  }
}
