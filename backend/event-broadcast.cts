type EventClient = {
  res?: {
    destroyed?: boolean;
    writableEnded?: boolean;
    write: (chunk: string) => unknown;
  } | null;
  user?: unknown;
};

type BuildPayload = (client: EventClient) => string;

function isWritableClient(client: EventClient | null | undefined): boolean {
  if (!client?.res || typeof client.res.write !== "function") {
    return false;
  }

  if (client.res.destroyed || client.res.writableEnded) {
    return false;
  }

  return true;
}

export function broadcastEventPayload(
  clients: Set<EventClient> | null | undefined,
  buildPayload: BuildPayload
): void {
  if (!clients || !clients.size) {
    return;
  }

  const staleClients: EventClient[] = [];
  clients.forEach((client) => {
    if (!isWritableClient(client)) {
      staleClients.push(client);
      return;
    }

    try {
      client.res?.write(buildPayload(client));
    } catch (_error) {
      staleClients.push(client);
    }
  });

  staleClients.forEach((client) => clients.delete(client));
}

module.exports = {
  broadcastEventPayload
};
