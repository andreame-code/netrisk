import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminConfigResponse,
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
  listAdminGames,
  listAdminUsers,
  runAdminGameAction,
  runAdminMaintenanceAction,
  updateAdminConfig,
  updateAdminUserRole
} from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
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

type AdminSection = "audit" | "config" | "games" | "maintenance" | "modules" | "overview" | "users";

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

function AdminMetric({
  label,
  value,
  tone = "muted"
}: {
  label: string;
  value: ReactNode;
  tone?: "danger" | "muted" | "success" | "warning";
}) {
  return (
    <article className={`card-panel admin-metric admin-metric-${tone}`}>
      <p className="status-label">{label}</p>
      <p className="admin-metric-value">{value}</p>
    </article>
  );
}

function SectionFrame({
  eyebrow,
  title,
  copy,
  actions,
  children
}: {
  eyebrow: string;
  title: string;
  copy: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-section-stack">
      <section className="hero-panel admin-hero-panel">
        <div className="admin-hero-copy">
          <p className="status-label">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-copy">{copy}</p>
        </div>
        {actions ? <div className="hero-actions">{actions}</div> : null}
      </section>
      {children}
    </div>
  );
}

function OverviewSection() {
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

  return (
    <SectionFrame
      eyebrow="Overview"
      title="Operational command center"
      copy="A fast read on the current NetRisk runtime: user volume, lobby health, invalid states, enabled modules, and the latest administrative activity."
      actions={
        <>
          <Link className="refresh-button" to="users">
            Review users
          </Link>
          <Link className="ghost-action" to="games">
            Inspect games
          </Link>
        </>
      }
    >
      <div className="grid-shell admin-metrics-grid">
        <AdminMetric label="Users" value={overview.summary.totalUsers} tone="success" />
        <AdminMetric label="Admins" value={overview.summary.adminUsers} />
        <AdminMetric label="Active games" value={overview.summary.activeGames} tone="success" />
        <AdminMetric label="Lobby queue" value={overview.summary.lobbyGames} />
        <AdminMetric
          label="Stale lobbies"
          value={overview.summary.staleLobbies}
          tone={overview.summary.staleLobbies > 0 ? "warning" : "success"}
        />
        <AdminMetric
          label="Invalid games"
          value={overview.summary.invalidGames}
          tone={overview.summary.invalidGames > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid-shell">
        <section className="card-panel admin-card-span">
          <div className="card-header">
            <div>
              <p className="status-label">Defaults</p>
              <h2>Current server defaults</h2>
            </div>
            <Link className="ghost-action" to="config">
              Edit config
            </Link>
          </div>
          <dl className="admin-definition-grid">
            <div>
              <dt>Content pack</dt>
              <dd>{overview.config.defaults.contentPackId || "system default"}</dd>
            </div>
            <div>
              <dt>Rule set</dt>
              <dd>{overview.config.defaults.ruleSetId || "system default"}</dd>
            </div>
            <div>
              <dt>Map</dt>
              <dd>{overview.config.defaults.mapId || "system default"}</dd>
            </div>
            <div>
              <dt>Theme</dt>
              <dd>{overview.config.defaults.themeId || "system default"}</dd>
            </div>
            <div>
              <dt>Modules</dt>
              <dd>
                {overview.config.defaults.activeModuleIds?.length
                  ? overview.config.defaults.activeModuleIds.join(", ")
                  : "Core only"}
              </dd>
            </div>
            <div>
              <dt>Stale lobby window</dt>
              <dd>{overview.config.maintenance.staleLobbyDays} days</dd>
            </div>
          </dl>
        </section>

        <section className="card-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Watchlist</p>
              <h2>Outstanding issues</h2>
            </div>
            <Link className="ghost-action" to="maintenance">
              Open maintenance
            </Link>
          </div>
          {overview.issues.length ? (
            <ul className="admin-issue-list">
              {overview.issues.map((issue, index) => (
                <li key={`${issue.code}:${issue.gameId || index}`} className="admin-issue-item">
                  <span className={`status-pill ${statusTone(issue.severity)}`}>
                    {issue.severity}
                  </span>
                  <div>
                    <strong>{issue.code}</strong>
                    <p>{issue.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-copy">No blocking issues detected in the latest scan.</p>
          )}
        </section>

        <section className="card-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Recent games</p>
              <h2>Latest sessions</h2>
            </div>
            <Link className="ghost-action" to="games">
              Open games
            </Link>
          </div>
          <ul className="admin-game-list">
            {overview.recentGames.map((game) => (
              <li key={game.id} className="admin-game-item">
                <div>
                  <strong>{game.name}</strong>
                  <p>
                    {game.phase} · {game.playerCount} players · updated{" "}
                    {formatTimestamp(game.updatedAt)}
                  </p>
                </div>
                <span className={`status-pill ${statusTone(game.health)}`}>{game.health}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Audit</p>
              <h2>Latest admin actions</h2>
            </div>
            <Link className="ghost-action" to="audit">
              Open audit log
            </Link>
          </div>
          <ul className="admin-audit-list">
            {overview.audit.map((entry) => (
              <li key={entry.id} className="admin-audit-item">
                <div>
                  <strong>{entry.action}</strong>
                  <p>
                    {entry.actorUsername} · {entry.targetType} · {formatTimestamp(entry.createdAt)}
                  </p>
                </div>
                <span
                  className={`status-pill ${entry.result === "success" ? "success" : "danger"}`}
                >
                  {entry.result}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SectionFrame>
  );
}

function UsersSection() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
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

  return (
    <SectionFrame
      eyebrow="Users"
      title="Manage roles and identity"
      copy="Search the current user base, inspect activity hints, and promote or demote administrators with server-side enforcement."
    >
      <section className="card-panel admin-toolbar-panel">
        <div className="admin-toolbar">
          <label className="shell-field">
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Username"
            />
          </label>
          <label className="shell-field">
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              <option value="admin">Admins</option>
              <option value="user">Users</option>
            </select>
          </label>
        </div>
        {roleMutation.isError ? (
          <p className="auth-feedback is-error">
            {messageFromError(roleMutation.error, "Unable to update that role.")}
          </p>
        ) : null}
      </section>

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
      ) : (
        <section className="card-panel admin-card-span">
          <div className="card-header">
            <div>
              <p className="status-label">Roster</p>
              <h2>
                {usersQuery.data.filteredTotal} of {usersQuery.data.total} users
              </h2>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Games</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                      <p className="admin-table-copy">
                        {user.hasEmail ? "Email on file" : "No email"} · theme{" "}
                        {user.preferences?.theme || "default"}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${user.role === "admin" ? "success" : "muted"}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td>
                      {user.gamesInProgress} in progress · {user.gamesPlayed} finished
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
      )}
    </SectionFrame>
  );
}

function GamesSection() {
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

  const selectedGame = detailsQuery.data?.game || null;

  function handleGameAction(action: "close-lobby" | "terminate-game" | "repair-game-config") {
    if (!selectedGameId) {
      return;
    }

    const destructive = action === "close-lobby" || action === "terminate-game";
    const confirmation = destructive
      ? window.prompt(`Type ${selectedGameId} to confirm ${action}.`)
      : null;

    actionMutation.mutate({
      gameId: selectedGameId,
      action,
      confirmation
    });
  }

  return (
    <SectionFrame
      eyebrow="Games"
      title="Inspect lobbies and sessions"
      copy="Filter active or finished games, inspect state and players, repair normalized config, or terminate broken sessions with confirmed server-side actions."
    >
      <section className="card-panel admin-toolbar-panel">
        <div className="admin-toolbar">
          <label className="shell-field">
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Game name or id"
            />
          </label>
          <label className="shell-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="lobby">Lobby</option>
              <option value="active">Active</option>
              <option value="finished">Finished</option>
            </select>
          </label>
        </div>
        {actionMutation.isError ? (
          <p className="auth-feedback is-error">
            {messageFromError(actionMutation.error, "Unable to complete that admin game action.")}
          </p>
        ) : null}
      </section>

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
          ) : (
            <ul className="admin-game-list">
              {gamesQuery.data.games.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    className={`admin-list-button${selectedGameId === game.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedGameId(game.id)}
                  >
                    <div>
                      <strong>{game.name}</strong>
                      <p>
                        {game.phase} · {game.playerCount} players ·{" "}
                        {formatTimestamp(game.updatedAt)}
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
            <div className="admin-inline-actions">
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

              <div className="admin-detail-grid">
                <section className="card-panel">
                  <p className="status-label">Players</p>
                  <ul className="admin-player-list">
                    {detailsQuery.data.players.map((player) => (
                      <li key={player.id}>
                        <strong>{player.name}</strong>
                        <p>
                          {player.isAi ? "AI" : player.linkedUserId || "Guest"} · territories{" "}
                          {player.territoryCount} · cards {player.cardCount}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="card-panel">
                  <p className="status-label">Issues</p>
                  {detailsQuery.data.game.issues.length ? (
                    <ul className="admin-issue-list">
                      {detailsQuery.data.game.issues.map((issue, index) => (
                        <li key={`${issue.code}:${index}`} className="admin-issue-item">
                          <span className={`status-pill ${statusTone(issue.severity)}`}>
                            {issue.severity}
                          </span>
                          <div>
                            <strong>{issue.code}</strong>
                            <p>{issue.message}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="status-copy">No issues detected for this session.</p>
                  )}
                </section>
              </div>

              <section className="card-panel">
                <p className="status-label">Raw state</p>
                <pre className="admin-json-block">
                  {JSON.stringify(detailsQuery.data.rawState, null, 2)}
                </pre>
              </section>
            </div>
          )}
        </section>
      </div>
    </SectionFrame>
  );
}

function ConfigSection() {
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
      actions={
        <button
          type="button"
          className="refresh-button"
          onClick={handleSave}
          disabled={!formState || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save defaults"}
        </button>
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
        <section className="card-panel admin-card-span">
          <div className="admin-form-grid">
            <label className="shell-field">
              <span>Content pack</span>
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
            </label>

            <label className="shell-field">
              <span>Rule set</span>
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
            </label>

            <label className="shell-field">
              <span>Map</span>
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
            </label>

            <label className="shell-field">
              <span>Dice rules</span>
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
            </label>

            <label className="shell-field">
              <span>Victory rules</span>
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
            </label>

            <label className="shell-field">
              <span>Player piece set</span>
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
            </label>

            <label className="shell-field">
              <span>Theme</span>
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
            </label>

            <label className="shell-field">
              <span>Piece skin</span>
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
            </label>

            <label className="shell-field">
              <span>Game preset</span>
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
            </label>

            <label className="shell-field">
              <span>Content profile</span>
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
            </label>

            <label className="shell-field">
              <span>Gameplay profile</span>
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
            </label>

            <label className="shell-field">
              <span>UI profile</span>
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
            </label>

            <label className="shell-field">
              <span>Turn timeout (hours)</span>
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
            </label>

            <label className="shell-field">
              <span>Total players</span>
              <input
                type="number"
                min={gameOptions.playerRange.min}
                max={gameOptions.playerRange.max}
                value={formState.totalPlayers}
                onChange={(event) => updateField("totalPlayers", event.target.value)}
              />
            </label>

            <label className="shell-field">
              <span>Stale lobby days</span>
              <input
                type="number"
                min={1}
                max={365}
                value={formState.staleLobbyDays}
                onChange={(event) => updateField("staleLobbyDays", event.target.value)}
              />
            </label>

            <label className="shell-field">
              <span>Audit log size</span>
              <input
                type="number"
                min={10}
                max={500}
                value={formState.auditLogLimit}
                onChange={(event) => updateField("auditLogLimit", event.target.value)}
              />
            </label>
          </div>

          <section className="admin-module-picker">
            <div className="card-header">
              <div>
                <p className="status-label">Modules</p>
                <h2>Runtime defaults</h2>
              </div>
            </div>
            <div className="admin-module-grid">
              {availableModules.map((moduleEntry) => {
                const checked = formState.activeModuleIds.includes(moduleEntry.id);
                return (
                  <label key={moduleEntry.id} className="admin-module-toggle">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleModule(moduleEntry.id, event.target.checked)}
                    />
                    <span>
                      <strong>{moduleEntry.displayName}</strong>
                      <small>{moduleEntry.id}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </section>
      )}
    </SectionFrame>
  );
}

function ModulesSection({ userId }: { userId: string }) {
  return (
    <SectionFrame
      eyebrow="Runtime"
      title="Modules and runtime content"
      copy="Enable, disable, and rescan modules using the existing server-side admin controls. The runtime catalog here is live, not mocked."
    >
      <section className="card-panel admin-card-span">
        <ProfileAdminModules userId={userId} />
      </section>
    </SectionFrame>
  );
}

function MaintenanceSection() {
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
        <div className="grid-shell">
          <AdminMetric label="Games checked" value={reportQuery.data.summary.totalGames} />
          <AdminMetric
            label="Stale lobbies"
            value={reportQuery.data.summary.staleLobbies}
            tone={reportQuery.data.summary.staleLobbies > 0 ? "warning" : "success"}
          />
          <AdminMetric
            label="Invalid games"
            value={reportQuery.data.summary.invalidGames}
            tone={reportQuery.data.summary.invalidGames > 0 ? "danger" : "success"}
          />
          <AdminMetric
            label="Orphaned module refs"
            value={reportQuery.data.summary.orphanedModuleReferences}
            tone={reportQuery.data.summary.orphanedModuleReferences > 0 ? "warning" : "success"}
          />

          <section className="card-panel admin-card-span">
            <div className="card-header">
              <div>
                <p className="status-label">Issues</p>
                <h2>Current maintenance findings</h2>
              </div>
            </div>
            {reportQuery.data.issues.length ? (
              <ul className="admin-issue-list">
                {reportQuery.data.issues.map((issue, index) => (
                  <li key={`${issue.code}:${issue.gameId || index}`} className="admin-issue-item">
                    <span className={`status-pill ${statusTone(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <div>
                      <strong>{issue.code}</strong>
                      <p>{issue.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="status-copy">No maintenance issues detected.</p>
            )}
          </section>
        </div>
      )}
    </SectionFrame>
  );
}

function AuditSection() {
  const auditQuery = useQuery({
    queryKey: adminAuditQueryKey(),
    queryFn: () => getAdminAudit(requestMessages("admin audit"))
  });

  return (
    <SectionFrame
      eyebrow="Audit"
      title="Administrative activity log"
      copy="A lightweight but persistent history of the most important admin mutations and validation runs."
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
      ) : (
        <section className="card-panel admin-card-span">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Result</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {auditQuery.data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.action}</td>
                    <td>{entry.actorUsername}</td>
                    <td>
                      {entry.targetType}
                      {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${entry.result === "success" ? "success" : "danger"}`}
                      >
                        {entry.result}
                      </span>
                    </td>
                    <td>{formatTimestamp(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

  useEffect(() => {
    document.title = "NetRisk Admin";
  }, []);

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

  const navItems: Array<{ id: AdminSection; label: string; path: string; description: string }> = [
    {
      id: "overview",
      label: "Overview",
      path: buildAdminPath(namespace),
      description: "Health, defaults, and latest admin activity."
    },
    {
      id: "users",
      label: "Users",
      path: `${buildAdminPath(namespace)}/users`,
      description: "Inspect and change roles."
    },
    {
      id: "games",
      label: "Games",
      path: `${buildAdminPath(namespace)}/games`,
      description: "Inspect, repair, and terminate sessions."
    },
    {
      id: "config",
      label: "Configurations",
      path: `${buildAdminPath(namespace)}/config`,
      description: "Global defaults and maintenance thresholds."
    },
    {
      id: "modules",
      label: "Runtime / Modules",
      path: `${buildAdminPath(namespace)}/modules`,
      description: "Live module catalog and runtime controls."
    },
    {
      id: "maintenance",
      label: "Maintenance",
      path: `${buildAdminPath(namespace)}/maintenance`,
      description: "Validation and cleanup operations."
    },
    {
      id: "audit",
      label: "Audit Log",
      path: `${buildAdminPath(namespace)}/audit`,
      description: "Recent admin mutations."
    }
  ];

  return (
    <div className="react-shell-page admin-page" data-testid="admin-route-page">
      <div className="admin-shell">
        <aside className="card-panel admin-sidebar">
          <div className="admin-sidebar-header">
            <p className="status-label">Admin</p>
            <h2>NetRisk Console</h2>
            <p className="status-copy">
              Signed in as <strong>{currentUser.username}</strong>.
            </p>
          </div>
          <nav className="admin-nav" aria-label="Admin sections">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={`admin-nav-link${section === item.id ? " is-active" : ""}`}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          {section === "overview" ? <OverviewSection /> : null}
          {section === "users" ? <UsersSection /> : null}
          {section === "games" ? <GamesSection /> : null}
          {section === "config" ? <ConfigSection /> : null}
          {section === "modules" ? <ModulesSection userId={currentUser.id} /> : null}
          {section === "maintenance" ? <MaintenanceSection /> : null}
          {section === "audit" ? <AuditSection /> : null}
        </main>
      </div>
    </div>
  );
}
