import { QueryClient } from "@tanstack/react-query";

const reactQueryDefaultOptions = {
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: false
    }
  }
} as const;

export function createReactQueryClient(): QueryClient {
  return new QueryClient(reactQueryDefaultOptions);
}

export const queryClient = createReactQueryClient();

export function profileDetailQueryKey(userId: string) {
  return ["profile", "detail", userId] as const;
}

export function lobbyGamesQueryKey() {
  return ["lobby", "games"] as const;
}

export function gameOptionsQueryKey() {
  return ["lobby", "game-options"] as const;
}

export function gameplayStateQueryKey(gameId: string) {
  return ["gameplay", "state", gameId] as const;
}
