/**
 * Live run progress over Server-Sent Events.
 *
 * Every connection gets a `snapshot` of the current state immediately, so a
 * tab that opens mid-run — or reconnects after a sleep — is caught up without
 * any replay buffer. `EventSource` reconnects on its own; the snapshot is the
 * reduced form of every event that came before it, which is why there is no
 * event log to replay.
 */

import type { ServerResponse } from 'http';
import { ApiError } from './errors.js';
import type { AuditSession, RunState } from './audit-session.js';

/**
 * Node's `http` is HTTP/1.1 and browsers allow six connections per host, so
 * unbounded streams would starve the dashboard's own fetches. Eight is above
 * any plausible number of open dashboards and well under the point where the
 * server stops answering.
 */
export const MAX_STREAMS = 8;

/** How often a comment is sent to keep the connection from idling out */
export const HEARTBEAT_MS = 15_000;

/**
 * Heartbeats a consumer may fall behind before it is dropped.
 *
 * A browser tab that stops reading (suspended, or a machine asleep) leaves
 * data buffered in the kernel; without this the server would hold it forever.
 */
const MAX_MISSED_HEARTBEATS = 3;

interface Stream {
  res: ServerResponse;
  /** Heartbeats written while the socket has refused to drain */
  missedHeartbeats: number;
}

export interface EventHubOptions {
  session: AuditSession;
  /** Injectable so tests do not wait 15 seconds */
  heartbeatMs?: number;
  setInterval?: (handler: () => void, ms: number) => NodeJS.Timeout;
  clearInterval?: (handle: NodeJS.Timeout) => void;
}

/**
 * Fans one run's state out to every connected dashboard.
 */
export class EventHub {
  private streams = new Set<Stream>();
  private heartbeat: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly options: EventHubOptions;

  constructor(options: EventHubOptions) {
    this.options = options;
  }

  /** How many dashboards are listening */
  get size(): number {
    return this.streams.size;
  }

  /**
   * Attach a new SSE connection.
   *
   * @throws ApiError 429 when the connection cap is reached
   */
  add(res: ServerResponse): void {
    if (this.streams.size >= MAX_STREAMS) {
      throw new ApiError(429, 'too-many-streams', `This server streams to at most ${MAX_STREAMS} dashboards.`, {
        hint: 'Close another dashboard tab and reload.',
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      // Nginx and friends buffer streamed responses by default, which would
      // hold every event until the run finished.
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    });

    const stream: Stream = { res, missedHeartbeats: 0 };
    this.streams.add(stream);

    res.on('close', () => {
      this.streams.delete(stream);
      this.stopIfIdle();
    });

    // The snapshot is what makes reconnection cheap: whatever happened before
    // this connection existed is already folded into the state.
    this.write(stream, 'snapshot', this.options.session.getState());

    this.start();
  }

  /** Begin fanning out and beating, once there is someone to talk to */
  private start(): void {
    if (this.unsubscribe === null) {
      this.unsubscribe = this.options.session.subscribe((state) => this.broadcast(state));
    }
    if (this.heartbeat === null) {
      const schedule = this.options.setInterval ?? setInterval;
      this.heartbeat = schedule(() => this.beat(), this.options.heartbeatMs ?? HEARTBEAT_MS);
      // Never hold the process open for a heartbeat.
      this.heartbeat.unref?.();
    }
  }

  private stopIfIdle(): void {
    if (this.streams.size > 0) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.heartbeat !== null) {
      (this.options.clearInterval ?? clearInterval)(this.heartbeat);
      this.heartbeat = null;
    }
  }

  /** Send the state to every listener */
  private broadcast(state: RunState): void {
    for (const stream of this.streams) {
      this.write(stream, 'state', state);
    }
  }

  private beat(): void {
    for (const stream of [...this.streams]) {
      // `write` returns false when the socket's buffer is full: the consumer
      // is not reading. A few of those is a slow network; several in a row is
      // a tab that has stopped listening.
      const drained = this.write(stream, 'heartbeat', {});
      stream.missedHeartbeats = drained ? 0 : stream.missedHeartbeats + 1;
      if (stream.missedHeartbeats >= MAX_MISSED_HEARTBEATS) {
        this.drop(stream);
      }
    }
  }

  /** @returns Whether the socket accepted the write without buffering */
  private write(stream: Stream, event: string, data: unknown): boolean {
    try {
      return stream.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.drop(stream);
      return false;
    }
  }

  private drop(stream: Stream): void {
    this.streams.delete(stream);
    try {
      stream.res.end();
    } catch {
      // Already gone
    }
    this.stopIfIdle();
  }

  /**
   * End every stream.
   *
   * Called before `server.close()`: an open SSE response is a live connection,
   * and `close()` waits for those, so a shutdown would otherwise hang for as
   * long as a dashboard tab stayed open.
   */
  closeAll(): void {
    for (const stream of [...this.streams]) {
      this.drop(stream);
    }
  }
}
