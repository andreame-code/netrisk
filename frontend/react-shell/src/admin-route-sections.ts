export type AdminSection =
  | "audit"
  | "config"
  | "content-studio"
  | "games"
  | "maintenance"
  | "modules"
  | "overview"
  | "system-health"
  | "users";

export type AdminIconName =
  | "activity"
  | "audit"
  | "bell"
  | "close"
  | "config"
  | "content"
  | "danger"
  | "game"
  | "health"
  | "home"
  | "maintenance"
  | "menu"
  | "modules"
  | "plus"
  | "refresh"
  | "search"
  | "shield"
  | "users";

export type AdminNavItem = {
  id: AdminSection;
  group: "Monitor" | "Operate";
  icon: AdminIconName;
  label: string;
  path: string;
  description: string;
};

export function resolveAdminSection(pathname: string): AdminSection {
  if (pathname.endsWith("/users")) {
    return "users";
  }

  if (pathname.endsWith("/games")) {
    return "games";
  }

  if (pathname.endsWith("/config")) {
    return "config";
  }

  if (pathname.endsWith("/content-studio")) {
    return "content-studio";
  }

  if (pathname.endsWith("/modules")) {
    return "modules";
  }

  if (pathname.endsWith("/maintenance")) {
    return "maintenance";
  }

  if (pathname.endsWith("/system-health")) {
    return "system-health";
  }

  if (pathname.endsWith("/audit")) {
    return "audit";
  }

  return "overview";
}

export function statusTone(
  health: string | null | undefined
): "danger" | "muted" | "success" | "warning" {
  if (health === "error") {
    return "danger";
  }

  if (health === "warning") {
    return "warning";
  }

  if (health === "ok") {
    return "success";
  }

  return "muted";
}

export function formatAdminPhase(phase: string | null | undefined): string {
  if (!phase) {
    return "Unknown";
  }

  return phase
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function severityRank(value: string | null | undefined): number {
  if (value === "error") {
    return 0;
  }

  if (value === "warning") {
    return 1;
  }

  if (value === "info") {
    return 2;
  }

  if (value === "ok") {
    return 3;
  }

  return 4;
}

export function sortBySeverity<T extends { severity: string | null | undefined }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity)
  );
}
