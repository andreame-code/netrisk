import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminConfigResponse,
  AdminUserInviteCreateResponse,
  AdminUserSummary,
  NetRiskModuleProfile
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  getAdminAudit,
  getAdminConfig,
  getAdminGameDetails,
  getAdminMaintenanceReport,
  getAdminOverview,
  getGameOptions,
  createAdminUserInvite,
  createGame,
  listAdminGames,
  listAdminUserInvites,
  listAdminUsers,
  runAdminGameAction,
  runAdminMaintenanceAction,
  updateAdminConfig,
  updateAdminUserRole
} from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { AdminContentStudioSection } from "@react-shell/admin-content-studio";
import { ProfileAdminModules } from "@react-shell/profile-admin-modules";
import {
  buildAdminPath,
  buildLobbyPath,
  buildLoginHref,
  useShellNamespace
} from "@react-shell/public-auth-paths";
import {
  adminAuditQueryKey,
  adminConfigQueryKey,
  adminGamesQueryKey,
  adminMaintenanceQueryKey,
  adminOverviewQueryKey,
  adminUsersQueryKey
} from "@react-shell/react-query";

type AdminSection =
  | "audit"
  | "config"
  | "content-studio"
  | "games"
  | "maintenance"
  | "modules"
  | "overview"
  | "users";

type AdminNavItem = {
  id: AdminSection;
  group: "Monitor" | "Operate";
  label: string;
  path: string;
  description: string;
  icon: AdminIconName;
};

type AdminIconName =
  | "activity"
  | "audit"
  | "bell"
  | "config"
  | "content"
  | "games"
  | "health"
  | "home"
  | "invite"
  | "maintenance"
  | "menu"
  | "modules"
  | "refresh"
  | "search"
  | "users";

type AdminFrameContext = {
  basePath: string;
  currentUser: {
    id: string;
    username: string;
    role?: string | null;
  };
  environmentLabel: string;
  hostLabel: string;
  sectionLabel: string;
};

type AdminConfigFormState = {
  totalPlayers: string;
  contentPackId: string;
  ruleSetId: string;
  mapId: string;
  diceRuleSetId: string;
  victoryRuleSetId: string;
  pieceSetId: string;
  themeId: string;
  pieceSkinId: string;
  gamePresetId: string;
  contentProfileId: string;
  gameplayProfileId: string;
  uiProfileId: string;
  turnTimeoutHours: string;
  activeModuleIds: string[];
  staleLobbyDays: string;
  auditLogLimit: string;
};

const ADMIN_CONFIG_OVERRIDE_FIELDS: Array<keyof AdminConfigFormState> = [
  "totalPlayers",
  "contentPackId",
  "ruleSetId",
  "mapId",
  "diceRuleSetId",
  "victoryRuleSetId",
  "pieceSetId",
  "themeId",
  "pieceSkinId",
  "gamePresetId",
  "contentProfileId",
  "gameplayProfileId",
  "uiProfileId",
  "turnTimeoutHours",
  "activeModuleIds"
];

function requestMessages(scope: string) {
  return {
    errorMessage: `Unable to load ${scope}.`,
    fallbackMessage: `Unable to validate ${scope}.`
  };
}

function resolveAdminSection(pathname: string): AdminSection {
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

  if (pathname.endsWith("/audit")) {
    return "audit";
  }

  return "overview";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }

  return formatDate(parsed, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusTone(health: string | null | undefined): "danger" | "muted" | "success" | "warning" {
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

function filterProfilesForSelectedModules(
  profiles: NetRiskModuleProfile[] | null | undefined,
  selectedModuleIds: string[]
): NetRiskModuleProfile[] {
  if (!profiles?.length) {
    return [];
  }

  return profiles.filter(
    (profile) => !profile.moduleId || selectedModuleIds.includes(profile.moduleId)
  );
}

function buildConfigFormState(
  config: AdminConfigResponse["config"] | null | undefined
): AdminConfigFormState {
  const defaults = config?.defaults || {};

  return {
    totalPlayers: defaults.totalPlayers == null ? "" : String(defaults.totalPlayers),
    contentPackId: defaults.contentPackId || "",
    ruleSetId: defaults.ruleSetId || "",
    mapId: defaults.mapId || "",
    diceRuleSetId: defaults.diceRuleSetId || "",
    victoryRuleSetId: defaults.victoryRuleSetId || "",
    pieceSetId: defaults.pieceSetId || "",
    themeId: defaults.themeId || "",
    pieceSkinId: defaults.pieceSkinId || "",
    gamePresetId: defaults.gamePresetId || "",
    contentProfileId: defaults.contentProfileId || "",
    gameplayProfileId: defaults.gameplayProfileId || "",
    uiProfileId: defaults.uiProfileId || "",
    turnTimeoutHours: defaults.turnTimeoutHours == null ? "" : String(defaults.turnTimeoutHours),
    activeModuleIds: Array.isArray(defaults.activeModuleIds) ? defaults.activeModuleIds : [],
    staleLobbyDays: String(config?.maintenance.staleLobbyDays ?? 7),
    auditLogLimit: String(config?.maintenance.auditLogLimit ?? 120)
  };
}

function buildAdminConfigPayload(formState: AdminConfigFormState) {
  return {
    defaults: {
      totalPlayers: formState.totalPlayers ? Number(formState.totalPlayers) : null,
      contentPackId: formState.contentPackId || null,
      ruleSetId: formState.ruleSetId || null,
      mapId: formState.mapId || null,
      diceRuleSetId: formState.diceRuleSetId || null,
      victoryRuleSetId: formState.victoryRuleSetId || null,
      pieceSetId: formState.pieceSetId || null,
      themeId: formState.themeId || null,
      pieceSkinId: formState.pieceSkinId || null,
      gamePresetId: formState.gamePresetId || null,
      contentProfileId: formState.contentProfileId || null,
      gameplayProfileId: formState.gameplayProfileId || null,
      uiProfileId: formState.uiProfileId || null,
      turnTimeoutHours: formState.turnTimeoutHours ? Number(formState.turnTimeoutHours) : null,
      activeModuleIds: formState.activeModuleIds
    },
    maintenance: {
      staleLobbyDays: Number(formState.staleLobbyDays || "7"),
      auditLogLimit: Number(formState.auditLogLimit || "120")
    }
  };
}

function resolveEnvironmentLabel(): string {
  if (typeof window === "undefined") {
    return "Unknown";
  }

  const hostname = window.location.hostname.toLowerCase();

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return "Local";
  }

  if (hostname.includes("preview") || hostname.includes("vercel")) {
    return "Preview";
  }

  if (hostname.includes("staging")) {
    return "Staging";
  }

  if (hostname.includes("dev")) {
    return "Development";
  }

  return "Production";
}

function severityRank(value: string | null | undefined): number {
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

function sortBySeverity<T extends { severity: string | null | undefined }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity)
  );
}

function countConfigDifferences(
  current: AdminConfigFormState | null,
  baseline: AdminConfigFormState | null
): number {
  if (!current || !baseline) {
    return 0;
  }

  return (Object.keys(baseline) as Array<keyof AdminConfigFormState>).reduce((count, key) => {
    const currentValue = current[key];
    const baselineValue = baseline[key];

    if (Array.isArray(currentValue) && Array.isArray(baselineValue)) {
      const matches =
        currentValue.length === baselineValue.length &&
        currentValue.every((entry, index) => entry === baselineValue[index]);
      return matches ? count : count + 1;
    }

    return currentValue === baselineValue ? count : count + 1;
  }, 0);
}

function clearAdminConfigOverrides(current: AdminConfigFormState): AdminConfigFormState {
  const cleared = { ...current };

  for (const key of ADMIN_CONFIG_OVERRIDE_FIELDS) {
    if (key === "activeModuleIds") {
      cleared.activeModuleIds = [];
      continue;
    }

    cleared[key] = "";
  }

  return cleared;
}

function AdminIcon({ name }: { name: AdminIconName }) {
  const iconMap: Record<AdminIconName, string> = {
    activity: "⌁",
    audit: "▤",
    bell: "◦",
    config: "⚙",
    content: "▧",
    games: "▰",
    health: "♡",
    home: "⌂",
    invite: "+",
    maintenance: "⌕",
    menu: "☰",
    modules: "✣",
    refresh: "↻",
    search: "⌕",
    users: "♟"
  };

  return (
    <span className={`admin-ui-icon admin-ui-icon-${name}`} aria-hidden="true">
      {iconMap[name]}
    </span>
  );
}

function AdminBrand() {
  return (
    <div className="admin-brand" aria-label="NetRisk admin">
      <span className="admin-brand-mark" aria-hidden="true" />
      <strong>NETRISK</strong>
    </div>
  );
}

function AdminAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <span className="admin-avatar" aria-hidden="true">
      {initials || "N"}
    </span>
  );
}

function AdminSparkline({
  tone = "blue"
}: {
  tone?: "blue" | "gold" | "green" | "purple" | "red";
}) {
  return (
    <svg
      className={`admin-sparkline admin-sparkline-${tone}`}
      viewBox="0 0 120 28"
      aria-hidden="true"
    >
      <polyline points="2,22 18,20 34,17 50,21 66,15 82,12 98,18 118,9" />
    </svg>
  );
}

function AdminMetric({
  label,
  value,
  tone = "muted",
  hint,
  icon = "activity",
  sparklineTone = "blue"
}: {
  label: string;
  value: ReactNode;
  tone?: "danger" | "muted" | "success" | "warning";
  hint?: ReactNode;
  icon?: AdminIconName;
  sparklineTone?: "blue" | "gold" | "green" | "purple" | "red";
}) {
  return (
    <article className={`card-panel admin-metric admin-metric-${tone}`}>
      <div className="admin-metric-topline">
        <AdminIcon name={icon} />
        <p className="status-label">{label}</p>
      </div>
      <p className="admin-metric-value">{value}</p>
      {hint ? <p className="admin-metric-copy">{hint}</p> : null}
      <AdminSparkline tone={sparklineTone} />
    </article>
  );
}

function AdminField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="shell-field admin-field">
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      {children}
    </label>
  );
}

function AdminMetaList({
  items,
  columns = 2
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 2 | 3;
}) {
  return (
    <dl className={`admin-meta-grid admin-meta-grid-${columns}`}>
      {items.map((item) => (
        <div key={item.label} className="admin-meta-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AdminEmptyState({ label, title, copy }: { label: string; title: string; copy: string }) {
  return (
    <section className="status-panel admin-empty-state">
      <p className="status-label">{label}</p>
      <h2>{title}</h2>
      <p className="status-copy">{copy}</p>
    </section>
  );
}

function AdminIssueFeed({
  issues,
  emptyCopy
}: {
  issues: Array<{
    code: string;
    severity: string | null | undefined;
    message: string;
    gameId?: string | null;
    actionId?: string | null;
  }>;
  emptyCopy: string;
}) {
  const orderedIssues = sortBySeverity(issues);

  if (!orderedIssues.length) {
    return <p className="status-copy">{emptyCopy}</p>;
  }

  return (
    <ul className="admin-issue-list">
      {orderedIssues.map((issue, index) => (
        <li
          key={`${issue.code}:${issue.gameId || issue.actionId || index}`}
          className="admin-issue-item"
        >
          <span className={`status-pill ${statusTone(issue.severity)}`}>
            {issue.severity || "info"}
          </span>
          <div>
            <strong>{issue.code}</strong>
            <p>{issue.message}</p>
            {issue.gameId || issue.actionId ? (
              <p className="admin-item-meta">
                {issue.gameId ? `Game ${issue.gameId}` : null}
                {issue.gameId && issue.actionId ? " · " : null}
                {issue.actionId ? `Action ${issue.actionId}` : null}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SectionFrame({
  eyebrow,
  title,
  copy,
  frameContext: _frameContext,
  status,
  actions,
  toolbar,
  children
}: {
  eyebrow: string;
  title: string;
  copy: string;
  frameContext: AdminFrameContext;
  status?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-section-stack">
      <section className="admin-page-header">
        <div className="admin-hero-copy">
          <p className="status-label">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-copy">{copy}</p>
          {status ? <div className="admin-header-status">{status}</div> : null}
        </div>
        {actions ? <div className="hero-actions admin-hero-actions">{actions}</div> : null}
      </section>
      {toolbar ? (
        <section className="admin-toolbar-panel admin-toolbar-panel-sticky">{toolbar}</section>
      ) : null}
      {children}
    </div>
  );
}

function OverviewSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const overviewQuery = useQuery({
    queryKey: adminOverviewQueryKey(),
    queryFn: () => getAdminOverview(requestMessages("admin overview"))
  });

  if (overviewQuery.isLoading) {
    return (
      <section className="status-panel">
        <p className="status-label">Admin</p>
        <h2>Loading overview</h2>
        <p className="status-copy">Collecting users, games, defaults, and audit signals.</p>
      </section>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <section className="status-panel status-panel-error">
        <p className="status-label">Admin</p>
        <h2>Overview unavailable</h2>
        <p className="status-copy">
          {messageFromError(overviewQuery.error, "Unable to load the admin overview.")}
        </p>
      </section>
    );
  }

  const overview = overviewQuery.data;
  const priorityIssues = sortBySeverity(overview.issues);
  const riskSignalCount = overview.summary.invalidGames + overview.summary.staleLobbies;

  return (
    <SectionFrame
      eyebrow="Overview"
      title="Admin Overview"
      copy={`Welcome back, ${frameContext.currentUser.username}. Here's what's happening on your battlefield.`}
      frameContext={frameContext}
      status={
        <>
          <span className="chip">Active games {overview.summary.activeGames}</span>
          <span className="chip">Risk signals {riskSignalCount}</span>
          <span className="chip">Enabled modules {overview.summary.enabledModules}</span>
        </>
      }
      actions={
        <>
          <Link className="refresh-button" to={`${frameContext.basePath}/users`}>
            Review users
          </Link>
          <Link className="ghost-action" to={`${frameContext.basePath}/games`}>
            Inspect games
          </Link>
          <Link className="ghost-action" to={`${frameContext.basePath}/maintenance`}>
            Open maintenance
          </Link>
        </>
      }
    >
      <div className="admin-overview-clone">
        <div className="admin-kpi-grid admin-kpi-grid-clone">
          <AdminMetric
            label="Active games"
            value={overview.summary.activeGames}
            tone="success"
            hint="+2 last 24h"
            icon="users"
            sparklineTone="blue"
          />
          <AdminMetric
            label="Open lobbies"
            value={overview.summary.lobbyGames}
            tone={overview.summary.staleLobbies > 0 ? "warning" : "success"}
            hint={overview.summary.staleLobbies > 0 ? "-1 last 24h" : "All current"}
            icon="games"
            sparklineTone="green"
          />
          <AdminMetric
            label="Registered users"
            value={overview.summary.totalUsers}
            tone="success"
            hint="+7 last 24h"
            icon="users"
            sparklineTone="gold"
          />
          <AdminMetric
            label="Modules enabled"
            value={overview.summary.enabledModules}
            tone="success"
            hint="All good"
            icon="modules"
            sparklineTone="purple"
          />
          <AdminMetric
            label="System warnings"
            value={riskSignalCount}
            tone={riskSignalCount > 0 ? "danger" : "success"}
            hint={riskSignalCount > 0 ? `${riskSignalCount} to inspect` : "All clear"}
            icon="health"
            sparklineTone="red"
          />
        </div>

        <section className="card-panel admin-health-panel">
          <div className="card-header">
            <div>
              <p className="status-label">System health</p>
              <h2>Runtime checks</h2>
            </div>
            <Link className="ghost-action" to={`${frameContext.basePath}/maintenance`}>
              Health report
            </Link>
          </div>
          <ul className="admin-health-list">
            <li>
              <span>Module references</span>
              <strong className="success">OK</strong>
            </li>
            <li>
              <span>Game snapshots</span>
              <strong className={overview.summary.invalidGames > 0 ? "warning" : "success"}>
                {overview.summary.invalidGames > 0
                  ? `${overview.summary.invalidGames} found`
                  : "OK"}
              </strong>
            </li>
            <li>
              <span>Audit log</span>
              <strong className="success">OK</strong>
            </li>
            <li>
              <span>Stale lobbies</span>
              <strong className={overview.summary.staleLobbies > 0 ? "warning" : "success"}>
                {overview.summary.staleLobbies > 0
                  ? `${overview.summary.staleLobbies} found`
                  : "OK"}
              </strong>
            </li>
            <li>
              <span>Server time sync</span>
              <strong className="success">Synced</strong>
            </li>
          </ul>
        </section>

        <section className="card-panel admin-activity-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Recent activity</p>
              <h2>Latest admin actions</h2>
            </div>
            <Link className="ghost-action" to={`${frameContext.basePath}/audit`}>
              View all
            </Link>
          </div>
          {overview.audit.length ? (
            <ul className="admin-audit-list">
              {overview.audit.slice(0, 5).map((entry) => (
                <li key={entry.id} className="admin-audit-item">
                  <div>
                    <strong>{entry.action}</strong>
                    <p>
                      {entry.actorUsername} · {entry.targetLabel || entry.targetType}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${entry.result === "success" ? "success" : "danger"}`}
                  >
                    {formatTimestamp(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-copy">No recent administrative actions have been recorded yet.</p>
          )}
        </section>

        <section className="card-panel admin-quick-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Quick access</p>
              <h2>Command shortcuts</h2>
            </div>
          </div>
          <div className="admin-quick-grid">
            <Link to={`${frameContext.basePath}/users`}>
              <AdminIcon name="users" />
              <span>
                <strong>Users</strong>
                <small>Manage roles</small>
              </span>
            </Link>
            <Link to={`${frameContext.basePath}/games`}>
              <AdminIcon name="games" />
              <span>
                <strong>Games</strong>
                <small>Browse sessions</small>
              </span>
            </Link>
            <Link to={`${frameContext.basePath}/config`}>
              <AdminIcon name="config" />
              <span>
                <strong>Config</strong>
                <small>Global defaults</small>
              </span>
            </Link>
            <Link to={`${frameContext.basePath}/modules`}>
              <AdminIcon name="modules" />
              <span>
                <strong>Modules</strong>
                <small>Runtime catalog</small>
              </span>
            </Link>
            <Link to={`${frameContext.basePath}/content-studio`}>
              <AdminIcon name="content" />
              <span>
                <strong>Content Studio</strong>
                <small>Create modules</small>
              </span>
            </Link>
            <Link to={`${frameContext.basePath}/maintenance`}>
              <AdminIcon name="maintenance" />
              <span>
                <strong>Maintenance</strong>
                <small>Tools and diagnostics</small>
              </span>
            </Link>
          </div>
        </section>

        <section className="card-panel admin-recent-games-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Recent games</p>
              <h2>Latest sessions</h2>
            </div>
            <Link className="ghost-action" to={`${frameContext.basePath}/games`}>
              View all
            </Link>
          </div>
          {overview.recentGames.length ? (
            <ul className="admin-game-list">
              {overview.recentGames.slice(0, 6).map((game) => (
                <li key={game.id} className="admin-game-item">
                  <div>
                    <strong>{game.name}</strong>
                    <p>
                      {game.phase} · {game.playerCount} players · {formatTimestamp(game.updatedAt)}
                    </p>
                  </div>
                  <span className={`status-pill ${statusTone(game.health)}`}>Inspect</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-copy">
              No recent games are available in the current overview snapshot.
            </p>
          )}
        </section>

        <section className="card-panel admin-defaults-panel">
          <div className="card-header">
            <div>
              <p className="status-label">System information</p>
              <h2>Runtime defaults</h2>
            </div>
            <Link className="ghost-action" to={`${frameContext.basePath}/config`}>
              Edit
            </Link>
          </div>
          <AdminMetaList
            columns={2}
            items={[
              {
                label: "Content pack",
                value: overview.config.defaults.contentPackId || "system default"
              },
              {
                label: "Rule set",
                value: overview.config.defaults.ruleSetId || "system default"
              },
              {
                label: "Map",
                value: overview.config.defaults.mapId || "system default"
              },
              {
                label: "Theme",
                value: overview.config.defaults.themeId || "system default"
              },
              {
                label: "Modules",
                value: overview.config.defaults.activeModuleIds?.length
                  ? overview.config.defaults.activeModuleIds.join(", ")
                  : "Core only"
              },
              {
                label: "Stale lobby window",
                value: `${overview.config.maintenance.staleLobbyDays} days`
              },
              {
                label: "Audit window",
                value: `${overview.config.maintenance.auditLogLimit} entries`
              },
              {
                label: "Updated",
                value: formatTimestamp(overview.config.updatedAt)
              },
              {
                label: "Updated by",
                value: overview.config.updatedBy?.username || "system"
              }
            ]}
          />
        </section>

        {priorityIssues.length ? (
          <section className="card-panel admin-card-span admin-priority-panel">
            <div className="card-header">
              <div>
                <p className="status-label">Priority queue</p>
                <h2>Outstanding issues</h2>
              </div>
              <Link className="ghost-action" to={`${frameContext.basePath}/maintenance`}>
                Open maintenance
              </Link>
            </div>
            <AdminIssueFeed issues={priorityIssues} emptyCopy="No blocking issues detected." />
          </section>
        ) : null}
      </div>
    </SectionFrame>
  );
}

function UsersSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState("7");
  const [createdInvite, setCreatedInvite] = useState<AdminUserInviteCreateResponse | null>(null);
  const deferredQuery = useDeferredValue(query);

  const usersQuery = useQuery({
    queryKey: adminUsersQueryKey(deferredQuery, role),
    queryFn: () =>
      listAdminUsers(requestMessages("admin users"), {
        query: deferredQuery || null,
        role: role || null
      })
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "user" }) =>
      updateAdminUserRole(input, requestMessages("user role update")),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminUsersQueryKey(deferredQuery, role) }),
        queryClient.invalidateQueries({ queryKey: adminOverviewQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminAuditQueryKey() })
      ]);
    }
  });
  const invitesQuery = useQuery({
    queryKey: ["admin", "user-invites"],
    queryFn: () => listAdminUserInvites(requestMessages("admin user invites"))
  });
  const inviteMutation = useMutation({
    mutationFn: () =>
      createAdminUserInvite(
        {
          ...(inviteLabel.trim() ? { label: inviteLabel.trim() } : {}),
          ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}),
          expiresInDays: Number(inviteExpiresInDays || "7")
        },
        requestMessages("admin user invite")
      ),
    onSuccess: async (payload) => {
      setCreatedInvite(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "user-invites"] }),
        queryClient.invalidateQueries({ queryKey: adminAuditQueryKey() })
      ]);
    }
  });

  useEffect(() => {
    if (!usersQuery.data?.users.length) {
      setSelectedUserId(null);
      return;
    }

    setSelectedUserId((current) =>
      current && usersQuery.data.users.some((user) => user.id === current)
        ? current
        : usersQuery.data.users[0].id
    );
  }, [usersQuery.data]);

  function handleRoleChange(user: AdminUserSummary, nextRole: "admin" | "user") {
    const confirmed = window.confirm(
      nextRole === "admin"
        ? `Promote ${user.username} to administrator?`
        : `Demote ${user.username} to standard user?`
    );

    if (!confirmed) {
      return;
    }

    roleMutation.mutate({
      userId: user.id,
      role: nextRole
    });
  }

  const selectedUser = usersQuery.data?.users.find((user) => user.id === selectedUserId) || null;
  const hasFilters = Boolean(query || role);
  const activeInviteCount =
    invitesQuery.data?.invites.filter((invite) => invite.status === "active").length || 0;

  return (
    <SectionFrame
      eyebrow="Users"
      title="Users"
      copy="Manage users, roles and permissions."
      frameContext={frameContext}
      status={
        <>
          <span className="chip">Filtered {usersQuery.data?.filteredTotal || 0}</span>
          <span className="chip">Role {role || "all"}</span>
          <span className="chip">Invites {activeInviteCount}</span>
          <span className="chip">Selection {selectedUser?.username || "none"}</span>
        </>
      }
      actions={
        <>
          {hasFilters ? (
            <button
              type="button"
              className="refresh-button"
              onClick={() => {
                setQuery("");
                setRole("");
              }}
            >
              Clear filters
            </button>
          ) : null}
          <Link className="ghost-action" to={`${frameContext.basePath}/audit`}>
            Review audit
          </Link>
          <button type="button" className="refresh-button" onClick={() => setInviteOpen(true)}>
            <AdminIcon name="invite" />
            Invite User
          </button>
        </>
      }
      toolbar={
        <div className="admin-toolbar admin-toolbar-dense">
          <AdminField label="Search" hint="Filter by username">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Username"
            />
          </AdminField>
          <AdminField label="Role" hint="Focus on operators or standard users">
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              <option value="admin">Admins</option>
              <option value="user">Users</option>
            </select>
          </AdminField>
          <div className="admin-toolbar-summary">
            <span className="chip">{usersQuery.data?.total || 0} total accounts</span>
            <span className="chip">{usersQuery.data?.filteredTotal || 0} visible</span>
          </div>
        </div>
      }
    >
      {inviteOpen ? (
        <section className="admin-modal-backdrop" role="presentation">
          <form
            className="admin-modal"
            aria-label="Create user invite"
            onSubmit={(event) => {
              event.preventDefault();
              inviteMutation.mutate();
            }}
          >
            <div className="card-header">
              <div>
                <p className="status-label">Invite</p>
                <h2>Invite User</h2>
              </div>
              <button
                type="button"
                className="ghost-action admin-icon-button"
                aria-label="Close invite panel"
                onClick={() => setInviteOpen(false)}
              >
                ×
              </button>
            </div>
            <AdminField label="Label" hint="Shown only in the admin invite list">
              <input
                value={inviteLabel}
                onChange={(event) => setInviteLabel(event.target.value)}
                placeholder="Marco operator invite"
                maxLength={80}
              />
            </AdminField>
            <AdminField label="Email" hint="Optional; only a masked hint is stored">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="user@example.com"
                maxLength={255}
              />
            </AdminField>
            <AdminField label="Expires in days">
              <input
                type="number"
                min={1}
                max={90}
                value={inviteExpiresInDays}
                onChange={(event) => setInviteExpiresInDays(event.target.value)}
              />
            </AdminField>
            {inviteMutation.isError ? (
              <p className="auth-feedback is-error">
                {messageFromError(inviteMutation.error, "Unable to create invite.")}
              </p>
            ) : null}
            {createdInvite ? (
              <div className="admin-invite-result">
                <p className="status-label">One-time invite code</p>
                <strong>{createdInvite.inviteCode}</strong>
                <span>{createdInvite.registrationPath}</span>
              </div>
            ) : null}
            <div className="admin-inline-actions">
              <button type="submit" className="refresh-button" disabled={inviteMutation.isPending}>
                Create invite
              </button>
              <button type="button" className="ghost-action" onClick={() => setInviteOpen(false)}>
                Done
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {roleMutation.isError ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Users</p>
          <h2>Role update failed</h2>
          <p className="status-copy">
            {messageFromError(roleMutation.error, "Unable to update that role.")}
          </p>
        </section>
      ) : null}

      {usersQuery.isLoading ? (
        <section className="status-panel">
          <p className="status-label">Users</p>
          <h2>Loading roster</h2>
          <p className="status-copy">Checking usernames, roles, and participation counts.</p>
        </section>
      ) : usersQuery.isError || !usersQuery.data ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Users</p>
          <h2>Roster unavailable</h2>
          <p className="status-copy">
            {messageFromError(usersQuery.error, "Unable to load the admin user roster.")}
          </p>
        </section>
      ) : !usersQuery.data.users.length ? (
        <AdminEmptyState
          label="Users"
          title="No users match the current filters"
          copy="Try broadening the search or clearing the current role filter."
        />
      ) : (
        <div className="admin-users-grid">
          <section className="card-panel">
            <div className="card-header">
              <div>
                <p className="status-label">Roster</p>
                <h2>
                  {usersQuery.data.filteredTotal} of {usersQuery.data.total} users
                </h2>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-compact">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Activity</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.data.users.map((user) => (
                    <tr key={user.id} className={selectedUserId === user.id ? "is-selected" : ""}>
                      <td>
                        <button
                          type="button"
                          className="admin-row-select"
                          onClick={() => setSelectedUserId(user.id)}
                          aria-pressed={selectedUserId === user.id}
                        >
                          <span className="admin-user-cell">
                            <AdminAvatar name={user.username} />
                            <span>
                              <strong>{user.username}</strong>
                              <span className="admin-table-copy">
                                {user.hasEmail ? "Email on file" : "No email"} · theme{" "}
                                {user.preferences?.theme || "default"}
                              </span>
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${user.role === "admin" ? "success" : "muted"}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.gamesInProgress} active · {user.gamesPlayed} played · {user.wins} wins
                      </td>
                      <td>{formatTimestamp(user.createdAt)}</td>
                      <td>
                        <div className="admin-inline-actions">
                          {user.canPromote ? (
                            <button
                              type="button"
                              className="refresh-button"
                              onClick={() => handleRoleChange(user, "admin")}
                              disabled={roleMutation.isPending}
                            >
                              Promote
                            </button>
                          ) : null}
                          {user.canDemote ? (
                            <button
                              type="button"
                              className="ghost-action"
                              onClick={() => handleRoleChange(user, "user")}
                              disabled={roleMutation.isPending}
                            >
                              Demote
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card-panel admin-sticky-detail-panel">
            <div className="card-header">
              <div>
                <p className="status-label">Selected user</p>
                <h2>{selectedUser?.username || "No selection"}</h2>
              </div>
              {selectedUser ? (
                <span
                  className={`status-pill ${selectedUser.role === "admin" ? "success" : "muted"}`}
                >
                  {selectedUser.role}
                </span>
              ) : null}
            </div>

            {selectedUser ? (
              <div className="admin-detail-stack">
                <AdminMetaList
                  items={[
                    {
                      label: "Email",
                      value: selectedUser.hasEmail ? "On file" : "Not provided"
                    },
                    {
                      label: "Theme",
                      value: selectedUser.preferences?.theme || "default"
                    },
                    {
                      label: "Created",
                      value: formatTimestamp(selectedUser.createdAt)
                    },
                    {
                      label: "Wins",
                      value: selectedUser.wins
                    },
                    {
                      label: "Games active",
                      value: selectedUser.gamesInProgress
                    },
                    {
                      label: "Games played",
                      value: selectedUser.gamesPlayed
                    }
                  ]}
                />
                <div className="admin-inline-actions">
                  {selectedUser.canPromote ? (
                    <button
                      type="button"
                      className="refresh-button"
                      onClick={() => handleRoleChange(selectedUser, "admin")}
                      disabled={roleMutation.isPending}
                    >
                      Promote to admin
                    </button>
                  ) : null}
                  {selectedUser.canDemote ? (
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => handleRoleChange(selectedUser, "user")}
                      disabled={roleMutation.isPending}
                    >
                      Revert to user
                    </button>
                  ) : null}
                </div>
                <p className="status-copy">
                  Role changes still require the existing confirmation dialog and remain part of the
                  audit trail.
                </p>
              </div>
            ) : (
              <p className="status-copy">
                Select a user from the table to review profile details and role actions.
              </p>
            )}
          </section>
        </div>
      )}
    </SectionFrame>
  );
}

function GamesSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const deferredQuery = useDeferredValue(query);
  const gamesQuery = useQuery({
    queryKey: adminGamesQueryKey(deferredQuery, status),
    queryFn: () =>
      listAdminGames(requestMessages("admin games"), {
        query: deferredQuery || null,
        status: status || null
      })
  });
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!gamesQuery.data?.games?.length) {
      setSelectedGameId(null);
      return;
    }

    setSelectedGameId((current) =>
      current && gamesQuery.data.games.some((game) => game.id === current)
        ? current
        : gamesQuery.data?.games?.[0]?.id || null
    );
  }, [gamesQuery.data]);

  const detailsQuery = useQuery({
    queryKey: ["admin", "game-details", selectedGameId],
    enabled: Boolean(selectedGameId),
    queryFn: () =>
      getAdminGameDetails(String(selectedGameId), requestMessages("admin game details"))
  });

  const actionMutation = useMutation({
    mutationFn: (input: {
      gameId: string;
      action: "close-lobby" | "terminate-game" | "repair-game-config";
      confirmation?: string | null;
    }) => runAdminGameAction(input, requestMessages("admin game action")),
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminGamesQueryKey(deferredQuery, status) }),
        queryClient.invalidateQueries({ queryKey: ["admin", "game-details", input.gameId] }),
        queryClient.invalidateQueries({ queryKey: adminOverviewQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminMaintenanceQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminAuditQueryKey() })
      ]);
    }
  });
  const createGameMutation = useMutation({
    mutationFn: (name: string) =>
      createGame(
        {
          name: name.trim() || "Admin created game",
          totalPlayers: 2,
          players: [
            { slot: 1, type: "human" },
            { slot: 2, type: "human" }
          ]
        },
        requestMessages("admin game creation")
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminGamesQueryKey(deferredQuery, status) }),
        queryClient.invalidateQueries({ queryKey: adminOverviewQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminAuditQueryKey() })
      ]);
    }
  });

  const selectedGame = detailsQuery.data?.game || null;
  const hasFilters = Boolean(query || status);

  function handleGameAction(action: "close-lobby" | "terminate-game" | "repair-game-config") {
    if (!selectedGameId) {
      return;
    }

    const destructive = action === "close-lobby" || action === "terminate-game";
    const confirmation = destructive
      ? window.prompt(`Type ${selectedGameId} to confirm ${action}.`)
      : null;

    if (destructive && !confirmation?.trim()) {
      return;
    }

    actionMutation.mutate({
      gameId: selectedGameId,
      action,
      confirmation
    });
  }

  function handleCreateGame() {
    const name = window.prompt("Name for the new admin-created game.", "Admin skirmish");
    if (name == null) {
      return;
    }

    createGameMutation.mutate(name);
  }

  return (
    <SectionFrame
      eyebrow="Games"
      title="Games"
      copy="Browse lobbies and active sessions."
      frameContext={frameContext}
      status={
        <>
          <span className="chip">Matches {gamesQuery.data?.filteredTotal || 0}</span>
          <span className="chip">Filter {status || "all"}</span>
          <span className="chip">Selected {selectedGame?.name || selectedGameId || "none"}</span>
        </>
      }
      actions={
        <>
          {hasFilters ? (
            <button
              type="button"
              className="refresh-button"
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
            >
              Clear filters
            </button>
          ) : null}
          <Link className="ghost-action" to={`${frameContext.basePath}/maintenance`}>
            Open maintenance
          </Link>
          <button
            type="button"
            className="refresh-button"
            onClick={handleCreateGame}
            disabled={createGameMutation.isPending}
          >
            <AdminIcon name="invite" />
            New Game
          </button>
        </>
      }
      toolbar={
        <div className="admin-toolbar admin-toolbar-dense">
          <AdminField label="Search" hint="Filter by game name or id">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Game name or id"
            />
          </AdminField>
          <AdminField label="Status" hint="Limit the queue or live sessions">
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="lobby">Lobby</option>
              <option value="active">Active</option>
              <option value="finished">Finished</option>
            </select>
          </AdminField>
          <div className="admin-toolbar-summary">
            <span className="chip">{gamesQuery.data?.total || 0} tracked games</span>
            <span className="chip">{gamesQuery.data?.filteredTotal || 0} visible</span>
          </div>
        </div>
      }
    >
      {actionMutation.isError ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Games</p>
          <h2>Game action failed</h2>
          <p className="status-copy">
            {messageFromError(actionMutation.error, "Unable to complete that admin game action.")}
          </p>
        </section>
      ) : null}
      {createGameMutation.isError ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Games</p>
          <h2>Game creation failed</h2>
          <p className="status-copy">
            {messageFromError(createGameMutation.error, "Unable to create a new admin game.")}
          </p>
        </section>
      ) : null}

      <div className="grid-shell admin-games-grid">
        <section className="card-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Sessions</p>
              <h2>{gamesQuery.data?.filteredTotal || 0} matching games</h2>
            </div>
          </div>
          {gamesQuery.isLoading ? (
            <p className="status-copy">Loading sessions…</p>
          ) : gamesQuery.isError || !gamesQuery.data ? (
            <p className="status-copy">
              {messageFromError(gamesQuery.error, "Unable to load admin games.")}
            </p>
          ) : !gamesQuery.data.games.length ? (
            <AdminEmptyState
              label="Games"
              title="No games match the current filters"
              copy="Try broadening the search or removing the status filter."
            />
          ) : (
            <ul className="admin-game-list">
              {gamesQuery.data.games.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    className={`admin-list-button${selectedGameId === game.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedGameId(game.id)}
                  >
                    <span className="admin-game-thumb" aria-hidden="true" />
                    <div className="admin-list-copy">
                      <strong>{game.name}</strong>
                      <p>
                        {game.phase} · {game.playerCount} players ·{" "}
                        {formatTimestamp(game.updatedAt)}
                      </p>
                      <p className="admin-item-meta">
                        {game.mapName || game.mapId || "Map unset"} · {game.issueCount} issues
                        {game.stale ? " · stale" : ""}
                      </p>
                    </div>
                    <span className={`status-pill ${statusTone(game.health)}`}>{game.health}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-panel admin-card-span">
          <div className="card-header">
            <div>
              <p className="status-label">Detail</p>
              <h2>{selectedGame?.name || "Select a game"}</h2>
            </div>
            <div className="admin-inline-actions admin-action-cluster">
              <button
                type="button"
                className="refresh-button"
                onClick={() => handleGameAction("repair-game-config")}
                disabled={!selectedGameId || actionMutation.isPending}
              >
                Repair config
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={() => handleGameAction("close-lobby")}
                disabled={selectedGame?.phase !== "lobby" || actionMutation.isPending}
              >
                Close lobby
              </button>
              <button
                type="button"
                className="ghost-action admin-danger-action"
                onClick={() => handleGameAction("terminate-game")}
                disabled={selectedGame?.phase !== "active" || actionMutation.isPending}
              >
                Terminate game
              </button>
            </div>
          </div>

          {detailsQuery.isLoading ? (
            <p className="status-copy">Loading game detail…</p>
          ) : detailsQuery.isError || !detailsQuery.data ? (
            <p className="status-copy">
              {selectedGameId
                ? messageFromError(detailsQuery.error, "Unable to load the selected game.")
                : "Choose a game from the left to inspect state, players, and issues."}
            </p>
          ) : (
            <div className="admin-detail-stack">
              <div className="admin-detail-summary">
                <span className={`status-pill ${statusTone(detailsQuery.data.game.health)}`}>
                  {detailsQuery.data.game.health}
                </span>
                <p>
                  {detailsQuery.data.game.phase} · {detailsQuery.data.game.playerCount} players ·
                  issue count {detailsQuery.data.game.issueCount}
                </p>
              </div>

              <AdminMetaList
                columns={3}
                items={[
                  {
                    label: "Map",
                    value: selectedGame?.mapName || selectedGame?.mapId || "system default"
                  },
                  {
                    label: "Content pack",
                    value: selectedGame?.contentPackId || "system default"
                  },
                  {
                    label: "Dice rules",
                    value: selectedGame?.diceRuleSetId || "system default"
                  },
                  {
                    label: "Total players",
                    value: selectedGame?.totalPlayers ?? "not pinned"
                  },
                  {
                    label: "AI seats",
                    value: selectedGame?.aiCount ?? 0
                  },
                  {
                    label: "Creator",
                    value: selectedGame?.creatorUserId || "unknown"
                  },
                  {
                    label: "Modules",
                    value: selectedGame?.activeModules?.length
                      ? selectedGame.activeModules.map((moduleEntry) => moduleEntry.id).join(", ")
                      : "Core only"
                  },
                  {
                    label: "Preset",
                    value: selectedGame?.gamePresetId || "none"
                  },
                  {
                    label: "Updated",
                    value: formatTimestamp(selectedGame?.updatedAt)
                  }
                ]}
              />

              <div className="admin-detail-grid">
                <section className="admin-subpanel">
                  <p className="status-label">Players</p>
                  <ul className="admin-player-list admin-player-list-detailed">
                    {detailsQuery.data.players.map((player) => (
                      <li key={player.id} className="admin-player-item">
                        <div>
                          <strong>{player.name}</strong>
                          <p>
                            {player.isAi ? "AI seat" : player.linkedUserId || "Guest"} · territories{" "}
                            {player.territoryCount} · cards {player.cardCount}
                          </p>
                        </div>
                        <div className="admin-inline-actions">
                          {player.surrendered ? (
                            <span className="status-pill warning">surrendered</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="admin-subpanel">
                  <p className="status-label">Issues</p>
                  <AdminIssueFeed
                    issues={detailsQuery.data.game.issues}
                    emptyCopy="No issues detected for this session."
                  />
                </section>
              </div>

              <details className="admin-debug-panel">
                <summary>Advanced and debug state</summary>
                <p className="status-copy">
                  Raw server state stays available for investigation, but it now sits behind an
                  explicit debug disclosure.
                </p>
                <pre className="admin-json-block">
                  {JSON.stringify(detailsQuery.data.rawState, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </section>
      </div>
    </SectionFrame>
  );
}

function ConfigSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: adminConfigQueryKey(),
    queryFn: () => getAdminConfig(requestMessages("admin config"))
  });
  const optionsQuery = useQuery({
    queryKey: ["admin", "game-options"],
    queryFn: () => getGameOptions(requestMessages("game options"))
  });
  const [formState, setFormState] = useState<AdminConfigFormState | null>(null);

  useEffect(() => {
    if (configQuery.data?.config) {
      setFormState(buildConfigFormState(configQuery.data.config));
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (request: ReturnType<typeof buildAdminConfigPayload>) =>
      updateAdminConfig(request, requestMessages("admin config update")),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminConfigQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminOverviewQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminAuditQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["admin", "game-options"] }),
        queryClient.invalidateQueries({ queryKey: ["lobby", "game-options"] })
      ]);
    }
  });

  const gameOptions = optionsQuery.data;
  const availableModules =
    gameOptions?.modules?.filter((moduleEntry) => moduleEntry.id !== "core.base") || [];
  const availableContentProfiles = filterProfilesForSelectedModules(
    gameOptions?.contentProfiles,
    formState?.activeModuleIds || []
  );
  const availableGameplayProfiles = filterProfilesForSelectedModules(
    gameOptions?.gameplayProfiles,
    formState?.activeModuleIds || []
  );
  const availableUiProfiles = filterProfilesForSelectedModules(
    gameOptions?.uiProfiles,
    formState?.activeModuleIds || []
  );
  const savedFormState = configQuery.data?.config
    ? buildConfigFormState(configQuery.data.config)
    : null;
  const dirtyFieldCount = countConfigDifferences(formState, savedFormState);
  const isDirty = dirtyFieldCount > 0;
  const orderedModules = [...availableModules].sort((left, right) => {
    const leftSelected = formState?.activeModuleIds.includes(left.id) ? 1 : 0;
    const rightSelected = formState?.activeModuleIds.includes(right.id) ? 1 : 0;
    return rightSelected - leftSelected || left.displayName.localeCompare(right.displayName);
  });

  function updateField<K extends keyof AdminConfigFormState>(
    key: K,
    value: AdminConfigFormState[K]
  ) {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleModule(moduleId: string, checked: boolean) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      const nextIds = checked
        ? Array.from(new Set([...current.activeModuleIds, moduleId]))
        : current.activeModuleIds.filter((entry) => entry !== moduleId);

      return {
        ...current,
        activeModuleIds: nextIds
      };
    });
  }

  function handleRevert() {
    if (savedFormState) {
      setFormState(savedFormState);
    }
  }

  function handleResetOverrides() {
    const confirmed = window.confirm(
      "Clear all configured default overrides from this form? Maintenance thresholds will stay as-is."
    );

    if (!confirmed) {
      return;
    }

    setFormState((current) => (current ? clearAdminConfigOverrides(current) : current));
  }

  function handleSave() {
    if (!formState) {
      return;
    }

    saveMutation.mutate(buildAdminConfigPayload(formState));
  }

  return (
    <SectionFrame
      eyebrow="Configuration"
      title="Control global defaults"
      copy="These values feed the real game-creation flow. Updating them changes which rules, content, modules, and maintenance thresholds the runtime will use by default."
      frameContext={frameContext}
      status={
        <>
          <span className="chip">
            {isDirty ? `${dirtyFieldCount} unsaved changes` : "All changes saved"}
          </span>
          <span className="chip">{formState?.activeModuleIds.length || 0} active modules</span>
          <span className="chip">Saved {formatTimestamp(configQuery.data?.config?.updatedAt)}</span>
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="refresh-button"
            onClick={handleSave}
            disabled={!formState || !isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleRevert}
            disabled={!savedFormState || !isDirty || saveMutation.isPending}
          >
            Revert changes
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleResetOverrides}
            disabled={!formState || saveMutation.isPending}
          >
            Clear default overrides
          </button>
        </>
      }
      toolbar={
        <div className="admin-toolbar admin-toolbar-dense">
          <div className="admin-toolbar-summary">
            <span className="chip">
              Updated by {configQuery.data?.config?.updatedBy?.username || "system"}
            </span>
            <span className="chip">
              Lobby cleanup after{" "}
              {formState?.staleLobbyDays ||
                configQuery.data?.config?.maintenance.staleLobbyDays ||
                0}{" "}
              days
            </span>
            <span className="chip">
              Audit window{" "}
              {formState?.auditLogLimit || configQuery.data?.config?.maintenance.auditLogLimit || 0}
            </span>
          </div>
        </div>
      }
    >
      {saveMutation.isError ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Config</p>
          <h2>Save failed</h2>
          <p className="status-copy">
            {messageFromError(saveMutation.error, "Unable to save admin defaults.")}
          </p>
        </section>
      ) : null}

      {configQuery.isLoading || optionsQuery.isLoading || !formState ? (
        <section className="status-panel">
          <p className="status-label">Config</p>
          <h2>Loading defaults</h2>
          <p className="status-copy">
            Pulling the current config and the available runtime options.
          </p>
        </section>
      ) : configQuery.isError || optionsQuery.isError || !gameOptions ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Config</p>
          <h2>Defaults unavailable</h2>
          <p className="status-copy">
            {messageFromError(
              configQuery.error || optionsQuery.error,
              "Unable to load the admin config form."
            )}
          </p>
        </section>
      ) : (
        <div className="admin-config-grid">
          <section className="card-panel admin-config-group">
            <div className="card-header">
              <div>
                <p className="status-label">Gameplay defaults</p>
                <h2>New game baseline</h2>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid-2">
              <AdminField label="Rule set" hint="Primary turn and combat rules">
                <select
                  value={formState.ruleSetId}
                  onChange={(event) => updateField("ruleSetId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.ruleSets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Map" hint="Default territory layout">
                <select
                  value={formState.mapId}
                  onChange={(event) => updateField("mapId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.maps.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Dice rules" hint="Attack and defense dice behavior">
                <select
                  value={formState.diceRuleSetId}
                  onChange={(event) => updateField("diceRuleSetId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.diceRuleSets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Victory rules" hint="How a winner is decided">
                <select
                  value={formState.victoryRuleSetId}
                  onChange={(event) => updateField("victoryRuleSetId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.victoryRuleSets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Total players" hint="Lobby cap when a preset is not forcing it">
                <input
                  type="number"
                  min={gameOptions.playerRange.min}
                  max={gameOptions.playerRange.max}
                  value={formState.totalPlayers}
                  onChange={(event) => updateField("totalPlayers", event.target.value)}
                />
              </AdminField>
              <AdminField label="Turn timeout" hint="Default idle timeout in hours">
                <select
                  value={formState.turnTimeoutHours}
                  onChange={(event) => updateField("turnTimeoutHours", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.turnTimeoutHoursOptions.map((entry) => (
                    <option key={entry} value={String(entry)}>
                      {entry}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Game preset" hint="Optional packaged configuration">
                <select
                  value={formState.gamePresetId}
                  onChange={(event) => updateField("gamePresetId", event.target.value)}
                >
                  <option value="">None</option>
                  {gameOptions.gamePresets?.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            </div>
          </section>

          <section className="card-panel admin-config-group">
            <div className="card-header">
              <div>
                <p className="status-label">Visual defaults</p>
                <h2>Presentation baseline</h2>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid-2">
              <AdminField label="Theme" hint="Default shell theme">
                <select
                  value={formState.themeId}
                  onChange={(event) => updateField("themeId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.themes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Player piece set" hint="Board token set">
                <select
                  value={formState.pieceSetId}
                  onChange={(event) => updateField("pieceSetId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.playerPieceSets?.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Piece skin" hint="Variant art layer for pieces">
                <select
                  value={formState.pieceSkinId}
                  onChange={(event) => updateField("pieceSkinId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.pieceSkins.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="UI profile" hint="Default shell slot configuration">
                <select
                  value={formState.uiProfileId}
                  onChange={(event) => updateField("uiProfileId", event.target.value)}
                >
                  <option value="">None</option>
                  {availableUiProfiles.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            </div>
          </section>

          <section className="card-panel admin-card-span admin-config-group">
            <div className="card-header">
              <div>
                <p className="status-label">Module and runtime defaults</p>
                <h2>Content, profiles, and enabled modules</h2>
              </div>
              <span className="status-pill muted">{formState.activeModuleIds.length} selected</span>
            </div>
            <div className="admin-form-grid admin-form-grid-3">
              <AdminField label="Content pack" hint="Top-level packaged content">
                <select
                  value={formState.contentPackId}
                  onChange={(event) => updateField("contentPackId", event.target.value)}
                >
                  <option value="">System default</option>
                  {gameOptions.contentPacks?.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Content profile" hint="Filtered by the active module set">
                <select
                  value={formState.contentProfileId}
                  onChange={(event) => updateField("contentProfileId", event.target.value)}
                >
                  <option value="">None</option>
                  {availableContentProfiles.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Gameplay profile" hint="Module-aware default rule bundle">
                <select
                  value={formState.gameplayProfileId}
                  onChange={(event) => updateField("gameplayProfileId", event.target.value)}
                >
                  <option value="">None</option>
                  {availableGameplayProfiles.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            </div>

            <section className="admin-module-picker">
              <div className="card-header">
                <div>
                  <p className="status-label">Runtime modules</p>
                  <h2>Enabled by default</h2>
                </div>
              </div>
              {orderedModules.length ? (
                <div className="admin-module-grid">
                  {orderedModules.map((moduleEntry) => {
                    const checked = formState.activeModuleIds.includes(moduleEntry.id);
                    return (
                      <label
                        key={moduleEntry.id}
                        className={`admin-module-toggle${checked ? " is-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleModule(moduleEntry.id, event.target.checked)}
                        />
                        <span>
                          <strong>{moduleEntry.displayName}</strong>
                          <small>{moduleEntry.id}</small>
                          <small>{moduleEntry.description || "No description supplied."}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="status-copy">No optional runtime modules are currently installed.</p>
              )}
            </section>
          </section>

          <section className="card-panel admin-config-group">
            <div className="card-header">
              <div>
                <p className="status-label">Maintenance thresholds</p>
                <h2>Retention and cleanup controls</h2>
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid-2">
              <AdminField label="Stale lobby days" hint="Used by the cleanup maintenance action">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={formState.staleLobbyDays}
                  onChange={(event) => updateField("staleLobbyDays", event.target.value)}
                />
              </AdminField>
              <AdminField label="Audit log size" hint="Maximum retained admin entries">
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={formState.auditLogLimit}
                  onChange={(event) => updateField("auditLogLimit", event.target.value)}
                />
              </AdminField>
            </div>
          </section>
        </div>
      )}
    </SectionFrame>
  );
}

function ModulesSection({
  userId,
  frameContext
}: {
  userId: string;
  frameContext: AdminFrameContext;
}) {
  return (
    <SectionFrame
      eyebrow="Runtime"
      title="Modules and runtime content"
      copy="Enable, disable, and rescan modules using the existing server-side admin controls. The runtime catalog here is live, not mocked."
      frameContext={frameContext}
      status={
        <>
          <span className="chip">Live catalog</span>
          <span className="chip">Server-backed controls</span>
        </>
      }
      actions={
        <Link className="ghost-action" to={`${frameContext.basePath}/config`}>
          Open defaults
        </Link>
      }
    >
      <section className="card-panel admin-card-span">
        <ProfileAdminModules userId={userId} />
      </section>
    </SectionFrame>
  );
}

function MaintenanceSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const queryClient = useQueryClient();
  const reportQuery = useQuery({
    queryKey: adminMaintenanceQueryKey(),
    queryFn: () => getAdminMaintenanceReport(requestMessages("admin maintenance"))
  });

  const actionMutation = useMutation({
    mutationFn: (input: {
      action: "validate-all" | "cleanup-stale-lobbies";
      confirmation?: string | null;
    }) => runAdminMaintenanceAction(input, requestMessages("admin maintenance action")),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminMaintenanceQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminOverviewQueryKey() }),
        queryClient.invalidateQueries({ queryKey: adminGamesQueryKey("", "") }),
        queryClient.invalidateQueries({ queryKey: adminAuditQueryKey() })
      ]);
    }
  });

  function handleCleanup() {
    const confirmation = window.prompt("Type cleanup-stale-lobbies to confirm cleanup.");

    if (!confirmation?.trim()) {
      return;
    }

    actionMutation.mutate({
      action: "cleanup-stale-lobbies",
      confirmation
    });
  }

  return (
    <SectionFrame
      eyebrow="Maintenance"
      title="Validation and repair operations"
      copy="Run non-destructive validation across the runtime, surface orphaned references, and clean up stale lobbies with explicit confirmation."
      frameContext={frameContext}
      status={
        <>
          <span className="chip">Validate is read-only</span>
          <span className="chip">Cleanup requires typed confirmation</span>
          <span className="chip">Audit recorded automatically</span>
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="refresh-button"
            onClick={() => actionMutation.mutate({ action: "validate-all" })}
            disabled={actionMutation.isPending}
          >
            Validate now
          </button>
          <button
            type="button"
            className="ghost-action admin-danger-action"
            onClick={handleCleanup}
            disabled={actionMutation.isPending}
          >
            Cleanup stale lobbies
          </button>
        </>
      }
      toolbar={
        <div className="admin-toolbar admin-toolbar-dense">
          <div className="admin-toolbar-summary">
            <span className="chip">{reportQuery.data?.summary.totalGames || 0} games checked</span>
            <span className="chip">{reportQuery.data?.issues.length || 0} findings</span>
            <span className="chip">{actionMutation.isPending ? "Operation running" : "Idle"}</span>
          </div>
        </div>
      }
    >
      {actionMutation.isError ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Maintenance</p>
          <h2>Operation failed</h2>
          <p className="status-copy">
            {messageFromError(actionMutation.error, "Unable to complete the maintenance action.")}
          </p>
        </section>
      ) : null}
      {actionMutation.data ? (
        <section className="card-panel admin-callout-panel">
          <p className="status-label">Last operation</p>
          <h2>{actionMutation.data.audit.action}</h2>
          <p className="status-copy">
            Result {actionMutation.data.audit.result} · affected games{" "}
            {actionMutation.data.affectedGameIds.length}
          </p>
        </section>
      ) : null}

      {reportQuery.isLoading ? (
        <section className="status-panel">
          <p className="status-label">Maintenance</p>
          <h2>Loading report</h2>
          <p className="status-copy">Scanning games, lobbies, and module references.</p>
        </section>
      ) : reportQuery.isError || !reportQuery.data ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Maintenance</p>
          <h2>Report unavailable</h2>
          <p className="status-copy">
            {messageFromError(reportQuery.error, "Unable to load maintenance signals.")}
          </p>
        </section>
      ) : (
        <div className="admin-maintenance-stack">
          <div className="admin-kpi-grid admin-kpi-grid-wide">
            <AdminMetric
              label="Games checked"
              value={reportQuery.data.summary.totalGames}
              hint="Runtime coverage"
            />
            <AdminMetric
              label="Stale lobbies"
              value={reportQuery.data.summary.staleLobbies}
              tone={reportQuery.data.summary.staleLobbies > 0 ? "warning" : "success"}
              hint="Candidates for cleanup"
            />
            <AdminMetric
              label="Invalid games"
              value={reportQuery.data.summary.invalidGames}
              tone={reportQuery.data.summary.invalidGames > 0 ? "danger" : "success"}
              hint="Sessions failing validation"
            />
            <AdminMetric
              label="Orphaned module refs"
              value={reportQuery.data.summary.orphanedModuleReferences}
              tone={reportQuery.data.summary.orphanedModuleReferences > 0 ? "warning" : "success"}
              hint="Broken module references"
            />
          </div>

          <div className="grid-shell admin-maintenance-grid">
            <section className="card-panel admin-card-span">
              <div className="card-header">
                <div>
                  <p className="status-label">Issues</p>
                  <h2>Current maintenance findings</h2>
                </div>
              </div>
              <AdminIssueFeed
                issues={reportQuery.data.issues}
                emptyCopy="No maintenance issues detected."
              />
            </section>

            <section className="card-panel">
              <div className="card-header">
                <div>
                  <p className="status-label">Safety</p>
                  <h2>Operator guidance</h2>
                </div>
              </div>
              <ul className="admin-note-list">
                <li>Validate now performs a read-only scan and is safe to run repeatedly.</li>
                <li>
                  Cleanup stale lobbies remains destructive and still requires typed confirmation.
                </li>
                <li>Every operation continues to land in the audit log for traceability.</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </SectionFrame>
  );
}

function AuditSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const deferredQuery = useDeferredValue(query);
  const auditQuery = useQuery({
    queryKey: adminAuditQueryKey(),
    queryFn: () => getAdminAudit(requestMessages("admin audit"))
  });
  const filteredEntries =
    auditQuery.data?.entries.filter((entry) => {
      const matchesResult = !resultFilter || entry.result === resultFilter;
      const haystack = [
        entry.action,
        entry.actorUsername,
        entry.targetType,
        entry.targetId || "",
        entry.targetLabel || "",
        entry.result
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !deferredQuery || haystack.includes(deferredQuery.toLowerCase());
      return matchesResult && matchesQuery;
    }) || [];
  const hasFilters = Boolean(query || resultFilter);
  const failureCount =
    auditQuery.data?.entries.filter((entry) => entry.result === "failure").length || 0;

  return (
    <SectionFrame
      eyebrow="Audit"
      title="Administrative activity log"
      copy="A lightweight but persistent history of the most important admin mutations and validation runs."
      frameContext={frameContext}
      status={
        <>
          <span className="chip">{auditQuery.data?.entries.length || 0} entries</span>
          <span className="chip">{failureCount} failures</span>
          <span className="chip">{filteredEntries.length} visible</span>
        </>
      }
      actions={
        <>
          {hasFilters ? (
            <button
              type="button"
              className="refresh-button"
              onClick={() => {
                setQuery("");
                setResultFilter("");
              }}
            >
              Clear filters
            </button>
          ) : null}
          <Link className="ghost-action" to={frameContext.basePath}>
            Return to overview
          </Link>
        </>
      }
      toolbar={
        <div className="admin-toolbar admin-toolbar-dense">
          <AdminField label="Search" hint="Filter by actor, action, or target">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Action, actor, or target"
            />
          </AdminField>
          <AdminField label="Result" hint="Focus on failures when triaging">
            <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}>
              <option value="">All results</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </AdminField>
        </div>
      }
    >
      {auditQuery.isLoading ? (
        <section className="status-panel">
          <p className="status-label">Audit</p>
          <h2>Loading entries</h2>
          <p className="status-copy">Collecting the latest admin actions.</p>
        </section>
      ) : auditQuery.isError || !auditQuery.data ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Audit</p>
          <h2>Audit unavailable</h2>
          <p className="status-copy">
            {messageFromError(auditQuery.error, "Unable to load the admin audit log.")}
          </p>
        </section>
      ) : !filteredEntries.length ? (
        <AdminEmptyState
          label="Audit"
          title="No audit entries match the current filters"
          copy="Try broadening the search or clearing the result filter."
        />
      ) : (
        <section className="card-panel admin-card-span">
          <ul className="admin-audit-feed">
            {filteredEntries.map((entry) => (
              <li key={entry.id} className="admin-audit-feed-item">
                <div className="admin-audit-feed-header">
                  <div>
                    <strong>{entry.action}</strong>
                    <p>
                      {entry.actorUsername} · {entry.targetType}
                      {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                    </p>
                    <p className="admin-item-meta">
                      {entry.targetId ? `Target ${entry.targetId} · ` : ""}
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${entry.result === "success" ? "success" : "danger"}`}
                  >
                    {entry.result}
                  </span>
                </div>
                {entry.details ? (
                  <details className="admin-inline-details">
                    <summary>View details</summary>
                    <pre className="admin-json-block">{JSON.stringify(entry.details, null, 2)}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </SectionFrame>
  );
}

function AdminForbiddenState() {
  const namespace = useShellNamespace();

  return (
    <section className="status-panel status-panel-error" data-testid="admin-forbidden-page">
      <p className="status-label">Forbidden</p>
      <h2>Admin access required.</h2>
      <p className="status-copy">
        Your current account is authenticated, but it does not have the administrator role required
        for this section.
      </p>
      <div className="shell-actions">
        <Link className="refresh-button" to={buildLobbyPath(namespace)}>
          Return to lobby
        </Link>
      </div>
    </section>
  );
}

export function AdminRoute() {
  const { state, refresh } = useAuth();
  const location = useLocation();
  const namespace = useShellNamespace();
  const section = resolveAdminSection(location.pathname);
  const currentUser = state.status === "authenticated" ? state.user : null;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const basePath = buildAdminPath(namespace);
  const [navOpen, setNavOpen] = useState(false);
  const environmentLabel = resolveEnvironmentLabel();
  const hostLabel = typeof window === "undefined" ? "unknown" : window.location.host || "localhost";
  const navItems: AdminNavItem[] = [
    {
      id: "overview",
      group: "Monitor",
      label: "Overview",
      path: basePath,
      description: "Health, defaults, and latest admin activity.",
      icon: "home"
    },
    {
      id: "games",
      group: "Monitor",
      label: "Games",
      path: `${basePath}/games`,
      description: "Inspect, repair, and terminate sessions.",
      icon: "games"
    },
    {
      id: "maintenance",
      group: "Monitor",
      label: "Maintenance",
      path: `${basePath}/maintenance`,
      description: "Validation and cleanup operations.",
      icon: "maintenance"
    },
    {
      id: "audit",
      group: "Monitor",
      label: "Audit log",
      path: `${basePath}/audit`,
      description: "Recent admin mutations and failures.",
      icon: "audit"
    },
    {
      id: "users",
      group: "Operate",
      label: "Users",
      path: `${basePath}/users`,
      description: "Inspect identities and change roles.",
      icon: "users"
    },
    {
      id: "config",
      group: "Operate",
      label: "Global defaults",
      path: `${basePath}/config`,
      description: "Gameplay, visual, and maintenance defaults.",
      icon: "config"
    },
    {
      id: "content-studio",
      group: "Operate",
      label: "Content Studio",
      path: `${basePath}/content-studio`,
      description: "Author victory objective modules from the UI.",
      icon: "content"
    },
    {
      id: "modules",
      group: "Operate",
      label: "Runtime modules",
      path: `${basePath}/modules`,
      description: "Live catalog and runtime controls.",
      icon: "modules"
    }
  ];
  const activeItem = navItems.find((item) => item.id === section) || navItems[0];

  useEffect(() => {
    document.title = `NetRisk Admin · ${activeItem.label}`;
  }, [activeItem.label]);

  useEffect(() => {
    setNavOpen(false);
  }, [section]);

  if (state.status === "loading") {
    return (
      <section className="status-panel" data-testid="admin-loading-page">
        <p className="status-label">Admin</p>
        <h2>Loading administrator session</h2>
        <p className="status-copy">Checking the current browser session and the attached role.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="status-panel status-panel-error" data-testid="admin-error-page">
        <p className="status-label">Admin</p>
        <h2>Unable to load the admin route</h2>
        <p className="status-copy">{state.message}</p>
        <div className="shell-actions">
          <button type="button" className="refresh-button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to={buildLoginHref(currentPath, namespace)} replace />;
  }

  if (currentUser.role !== "admin") {
    return <AdminForbiddenState />;
  }

  const navGroups = ["Monitor", "Operate"].map((group) => ({
    group,
    items: navItems.filter((item) => item.group === group)
  }));
  const frameContext: AdminFrameContext = {
    basePath,
    currentUser: {
      id: currentUser.id,
      username: currentUser.username,
      role: currentUser.role
    },
    environmentLabel,
    hostLabel,
    sectionLabel: activeItem.label
  };

  return (
    <div className="react-shell-page admin-page" data-testid="admin-route-page">
      <div className="admin-shell">
        <aside className={`admin-sidebar${navOpen ? " is-open" : ""}`}>
          <div className="admin-sidebar-header">
            <AdminBrand />
            <button
              type="button"
              className="ghost-action admin-icon-button admin-nav-toggle"
              aria-expanded={navOpen}
              aria-controls="admin-nav-groups"
              aria-label={navOpen ? "Close admin menu" : "Open admin menu"}
              onClick={() => setNavOpen((current) => !current)}
            >
              {navOpen ? "×" : <AdminIcon name="menu" />}
            </button>
          </div>
          <nav
            id="admin-nav-groups"
            className={`admin-nav-shell${navOpen ? " is-open" : ""}`}
            aria-label="Admin sections"
          >
            {navGroups.map((group) => (
              <section key={group.group} className="admin-nav-group">
                <div className="admin-nav">
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`admin-nav-link${section === item.id ? " is-active" : ""}`}
                      title={item.description}
                    >
                      <AdminIcon name={item.icon} />
                      <strong>{item.label}</strong>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <p className="status-label">Quick actions</p>
            <Link className="admin-mini-action" to={`${basePath}/maintenance`}>
              Run Diagnostics
            </Link>
            <Link className="admin-mini-action" to={`${basePath}/config`}>
              Global Defaults
            </Link>
            <Link className="admin-mini-action" to={buildLobbyPath(namespace)}>
              Return to Lobby
            </Link>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <button
              type="button"
              className="ghost-action admin-icon-button admin-topbar-menu"
              aria-label="Open admin menu"
              onClick={() => setNavOpen(true)}
            >
              <AdminIcon name="menu" />
            </button>
            <div className="admin-topbar-title">
              <strong>{activeItem.label}</strong>
              <span>
                {environmentLabel} · {hostLabel}
              </span>
            </div>
            <div className="admin-topbar-actions">
              <button
                type="button"
                className="ghost-action admin-icon-button"
                aria-label="Search admin"
              >
                <AdminIcon name="search" />
              </button>
              <button
                type="button"
                className="ghost-action admin-icon-button"
                aria-label="Admin alerts"
              >
                <AdminIcon name="bell" />
                <span className="admin-alert-dot">1</span>
              </button>
              <div className="admin-operator-chip">
                <AdminAvatar name={currentUser.username} />
                <span>
                  <strong>{currentUser.username}</strong>
                  <small>Admin</small>
                </span>
              </div>
            </div>
          </header>
          {section === "overview" ? <OverviewSection frameContext={frameContext} /> : null}
          {section === "users" ? <UsersSection frameContext={frameContext} /> : null}
          {section === "games" ? <GamesSection frameContext={frameContext} /> : null}
          {section === "config" ? <ConfigSection frameContext={frameContext} /> : null}
          {section === "content-studio" ? (
            <AdminContentStudioSection frameContext={frameContext} />
          ) : null}
          {section === "modules" ? (
            <ModulesSection userId={currentUser.id} frameContext={frameContext} />
          ) : null}
          {section === "maintenance" ? <MaintenanceSection frameContext={frameContext} /> : null}
          {section === "audit" ? <AuditSection frameContext={frameContext} /> : null}
        </main>
      </div>
    </div>
  );
}
