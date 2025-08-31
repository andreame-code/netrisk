class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, handler) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event].delete(handler);
    if (this.listeners[event].size === 0) {
      delete this.listeners[event];
    }
  }

  emit(event, payload) {
    if (!this.listeners[event]) return;
    for (const handler of [...this.listeners[event]]) {
      try {
        handler(payload);
      } catch (err) {
        // isolate handler errors
        // eslint-disable-next-line no-console
        console.error("Event handler error", err);
      }
    }
  }
}

export default EventBus;
