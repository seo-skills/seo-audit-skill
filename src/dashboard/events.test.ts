import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { EventHub, MAX_STREAMS } from './events.js';
import { ApiError } from './errors.js';
import type { ServerResponse } from 'http';
import type { AuditSession, RunState } from './audit-session.js';

/** A response that records what was written and whether it accepted it */
function fakeResponse(options: { drains?: boolean } = {}) {
  const emitter = new EventEmitter() as EventEmitter & Partial<ServerResponse>;
  const frames: Array<{ event: string; data: unknown }> = [];
  let ended = false;

  const res = Object.assign(emitter, {
    writeHead: vi.fn(),
    write: vi.fn((chunk: string) => {
      const event = /^event: (.*)$/m.exec(chunk)?.[1] ?? '';
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      frames.push({ event, data: data ? JSON.parse(data) : null });
      return options.drains ?? true;
    }),
    end: vi.fn(() => {
      ended = true;
    }),
  }) as unknown as ServerResponse;

  return { res, frames, isEnded: () => ended, close: () => emitter.emit('close') };
}

/** A session stand-in whose state the test drives */
function fakeSession(state: Partial<RunState> = {}) {
  const listeners = new Set<(s: RunState) => void>();
  const current = { status: 'idle', runId: null, ...state } as RunState;
  return {
    session: {
      getState: () => current,
      subscribe: (listener: (s: RunState) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as unknown as AuditSession,
    emit: (next: RunState) => listeners.forEach((l) => l(next)),
    listenerCount: () => listeners.size,
  };
}

describe('EventHub', () => {
  it('sends the current state on connect, so a late tab needs no replay', () => {
    const { session } = fakeSession({ status: 'running', runId: 'r1' } as Partial<RunState>);
    const hub = new EventHub({ session });
    const client = fakeResponse();

    hub.add(client.res);

    expect(client.frames).toHaveLength(1);
    expect(client.frames[0]!.event).toBe('snapshot');
    expect(client.frames[0]!.data).toMatchObject({ status: 'running', runId: 'r1' });
  });

  it('fans every state change out to every listener', () => {
    const { session, emit } = fakeSession();
    const hub = new EventHub({ session });
    const a = fakeResponse();
    const b = fakeResponse();
    hub.add(a.res);
    hub.add(b.res);

    emit({ status: 'running', runId: 'r2' } as RunState);

    expect(a.frames.at(-1)).toMatchObject({ event: 'state', data: { runId: 'r2' } });
    expect(b.frames.at(-1)).toMatchObject({ event: 'state', data: { runId: 'r2' } });
  });

  it('refuses more streams than it can serve', () => {
    const { session } = fakeSession();
    const hub = new EventHub({ session });
    for (let i = 0; i < MAX_STREAMS; i++) hub.add(fakeResponse().res);

    expect(hub.size).toBe(MAX_STREAMS);
    try {
      hub.add(fakeResponse().res);
      throw new Error('expected a rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(429);
      expect((error as ApiError).code).toBe('too-many-streams');
    }
  });

  it('forgets a stream when its connection closes', () => {
    const { session, listenerCount } = fakeSession();
    const hub = new EventHub({ session });
    const client = fakeResponse();
    hub.add(client.res);
    expect(hub.size).toBe(1);

    client.close();

    expect(hub.size).toBe(0);
    // No listeners left on the session either, or a finished dashboard would
    // keep the hub subscribed forever.
    expect(listenerCount()).toBe(0);
  });

  it('drops a consumer that stops reading', () => {
    const { session } = fakeSession();
    const beats: Array<() => void> = [];
    const hub = new EventHub({
      session,
      setInterval: ((handler: () => void) => {
        beats.push(handler);
        return { unref: () => {} } as unknown as NodeJS.Timeout;
      }) as never,
      clearInterval: (() => {}) as never,
    });

    // A socket that never drains: a suspended tab, or a sleeping machine.
    const stalled = fakeResponse({ drains: false });
    const healthy = fakeResponse({ drains: true });
    hub.add(stalled.res);
    hub.add(healthy.res);

    // Three heartbeats of back-pressure is the limit.
    beats[0]!();
    expect(hub.size).toBe(2);
    beats[0]!();
    expect(hub.size).toBe(2);
    beats[0]!();

    expect(hub.size).toBe(1);
    expect(stalled.isEnded()).toBe(true);
    expect(healthy.isEnded()).toBe(false);
  });

  it('ends every stream on shutdown, so close() is not held open', () => {
    const { session } = fakeSession();
    const hub = new EventHub({ session });
    const a = fakeResponse();
    const b = fakeResponse();
    hub.add(a.res);
    hub.add(b.res);

    hub.closeAll();

    expect(hub.size).toBe(0);
    expect(a.isEnded()).toBe(true);
    expect(b.isEnded()).toBe(true);
  });
});
