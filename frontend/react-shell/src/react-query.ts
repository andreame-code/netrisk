import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: false
    }
  }
});

export function profileDetailQueryKey(userId: string) {
  return ["profile", "detail", userId] as const;
}

export function lobbyGamesQueryKey() {
  return ["lobby", "games"] as const;
}

export function gameOptionsQueryKey() {
  return ["lobby", "game-options"] as const;
}
