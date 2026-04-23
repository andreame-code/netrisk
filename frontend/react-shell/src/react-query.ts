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

export function profileModulesCatalogQueryKey(userId: string) {
  return ["profile", "modules", "catalog", userId] as const;
}

export function profileModuleOptionsQueryKey(userId: string) {
  return ["profile", "modules", "options", userId] as const;
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

export function adminOverviewQueryKey() {
  return ["admin", "overview"] as const;
}

export function adminUsersQueryKey(query: string, role: string) {
  return ["admin", "users", query, role] as const;
}

export function adminGamesQueryKey(query: string, status: string) {
  return ["admin", "games", query, status] as const;
}

export function adminConfigQueryKey() {
  return ["admin", "config"] as const;
}

export function adminMaintenanceQueryKey() {
  return ["admin", "maintenance"] as const;
}

export function adminAuditQueryKey() {
  return ["admin", "audit"] as const;
}

export function adminContentStudioOptionsQueryKey() {
  return ["admin", "content-studio", "options"] as const;
}

export function adminContentStudioModulesQueryKey() {
  return ["admin", "content-studio", "modules"] as const;
}

export function adminContentStudioModuleDetailQueryKey(moduleId: string | null) {
  return ["admin", "content-studio", "module-detail", moduleId || "new"] as const;
}
