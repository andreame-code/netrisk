import { registerFrontendObservabilityReporter } from "@frontend-core/observability.mts";
import { subscribeToGameEvents } from "@frontend-core/api/client.mts";

import { afterEach, describe, expect, it, vi } from "vitest";

type FakeMessageEvent = {
  data: string;
};

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: FakeMessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly url: string;
  readonly withCredentials: boolean;
  closed = false;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = Boolean(options?.withCredentials);
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.onopen?.();
  }

  emitMessage(payload: unknown): void {
    this.onmessage?.({
      data: JSON.stringify(payload)
    });
  }
}

describe("game event subscription boundary", () => {
  afterEach(() => {
    FakeEventSource.instances.length = 0;
    registerFrontendObservabilityReporter(null);
    vi.unstubAllGlobals();
  });

  it("forwards validated game events to subscribers", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const onMessage = vi.fn();
    const onOpen = vi.fn();
    const stream = subscribeToGameEvents({
      gameId: "g-1",
      onMessage,
      onOpen
    });

    const eventSource = FakeEventSource.instances[0];
    expect(eventSource.url).toBe("/api/events?gameId=g-1");
    expect(eventSource.withCredentials).toBe(true);

    eventSource.emitOpen();
    eventSource.emitMessage({
      gameId: "g-1",
      players: [],
      map: [],
      reinforcementPool: 3
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: "g-1",
        reinforcementPool: 3
      })
    );

    stream.close();
    expect(eventSource.closed).toBe(true);
  });

  it("reports invalid event payloads without forwarding them to the UI", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    const onMessage = vi.fn();
    const onInvalidPayload = vi.fn();

    subscribeToGameEvents({
      gameId: "g-1",
      onMessage,
      onInvalidPayload
    });

    const eventSource = FakeEventSource.instances[0];
    eventSource.emitMessage({
      gameId: "g-1",
      players: "bad-payload",
      map: [],
      reinforcementPool: 3
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(onInvalidPayload).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        category: "validation",
        kind: "response_validation",
        path: "/api/events?gameId=g-1",
        schemaName: "GameEventPayload"
      })
    );
  });

  it("does not swallow subscriber exceptions as payload validation errors", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);

    const reporter = vi.fn();
    registerFrontendObservabilityReporter(reporter);

    const onInvalidPayload = vi.fn();

    subscribeToGameEvents({
      gameId: "g-1",
      onMessage: () => {
        throw new Error("Subscriber exploded.");
      },
      onInvalidPayload
    });

    const eventSource = FakeEventSource.instances[0];

    expect(() => {
      eventSource.emitMessage({
        gameId: "g-1",
        players: [],
        map: [],
        reinforcementPool: 3
      });
    }).toThrow("Subscriber exploded.");

    expect(onInvalidPayload).not.toHaveBeenCalled();
    expect(reporter).not.toHaveBeenCalled();
  });
});
