const crypto = require("node:crypto");
const {
  findPieceSkin,
  findVictoryRuleSet,
  findVisualTheme,
  migrateGameStateExtensions
} = require("../shared/extensions.cjs");

type PublicUser = {
  id: string;
  username: string;
  role?: string;
  authMethods?: string[];
  hasEmail?: boolean;
  preferences?: {
    theme?: string | null;
  } | null;
};

type StoredUser = {
  id: string;
  username: string;
  role?: string;
  profile?: {
    preferences?: {
      theme?: string | null;
    } | null;
  } | null;
  createdAt?: string;
};

type GamePlayer = {
  id?: string;
  name?: string;
  linkedUserId?: string | null;
  isAi?: boolean;
  surrendered?: boolean;
};

type GameState = {
  phase?: string;
  currentTurnIndex?: number;
  winnerId?: string | null;
  turnPhase?: string | null;
  players?: GamePlayer[];
  territories?: Record<string, { ownerId?: string | null }>;
  hands?: Record<string, unknown[]>;
  gameConfig?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type GameSummary = {
  id: string;
  name: string;
  version?: number;
  phase: string;
  playerCount: number;
  totalPlayers?: number | null;
  creatorUserId?: string | null;
  contentPackId?: string | null;
  mapId?: string | null;
  mapName?: string | null;
  diceRuleSetId?: string | null;
  activeModules?: Array<{ id: string; version: string }>;
  gamePresetId?: string | null;
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  updatedAt: string;
  createdAt?: string;
};

type RawGameRecord = {
  id: string;
  name: string;
  version?: number;
  creatorUserId?: string | null;
  state: GameState;
  createdAt: string;
  updatedAt: string;
};

type GameContext = {
  gameId: string | null;
  gameName: string | null;
  version: number | null;
  state: GameState;
};

type AdminConfigRecord = {
  defaults: Record<string, unknown>;
  maintenance: {
    staleLobbyDays: number;
    auditLogLimit: number;
  };
  updatedAt: string | null;
  updatedBy: PublicUser | null;
};

type AdminAuditEntry = {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  result: "success" | "failure";
  createdAt: string;
  details: Record<string, unknown> | null;
};

type AdminIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  gameId?: string | null;
  actionId?: string | null;
};

type AdminConsoleOptions = {
  datastore: {
    listUsers(): Promise<StoredUser[]> | StoredUser[];
    findUserById(userId: string): Promise<StoredUser | null> | StoredUser | null;
    updateUserRoleByUsername(username: string, role: string): Promise<void> | void;
    getAppState(key: string): Promise<unknown> | unknown;
    setAppState(key: string, value: unknown): Promise<unknown> | unknown;
  };
  auth: {
    publicUser(user: StoredUser | null | undefined): PublicUser | null;
  };
  gameSessions: {
    listGames(): Promise<GameSummary[]> | GameSummary[];
    getGame(gameId: string):
      | Promise<{ game: GameSummary; state: GameState }>
      | {
          game: GameSummary;
          state: GameState;
        };
    datastore: {
      listGames(): Promise<RawGameRecord[]> | RawGameRecord[];
    };
  };
  loadGameContext(gameId: string | null): Promise<GameContext>;
  persistGameContext(gameContext: GameContext, expectedVersion?: number | null): Promise<unknown>;
  broadcastGame(gameContext: GameContext): void;
  createConfiguredInitialState(
    configInput?: Record<string, unknown>,
    options?: Record<string, unknown>
  ):
    | Promise<{ state: GameState; config: Record<string, unknown> }>
    | {
        state: GameState;
        config: Record<string, unknown>;
      };
  moduleRuntime: {
    listInstalledModules(): Promise<Array<Record<string, unknown>>>;
    getEnabledModules(): Promise<Array<{ id: string; version: string }>>;
    findSupportedMap(mapId: string): Record<string, unknown> | null;
    findContentPack(contentPackId: string): Record<string, unknown> | null;
    findPlayerPieceSet(pieceSetId: string): Record<string, unknown> | null;
    findDiceRuleSet(diceRuleSetId: string): Record<string, unknown> | null;
    resolveGamePreset(input?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    resolveGameConfigDefaults(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    resolveGameSelection(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

const ADMIN_CONFIG_STATE_KEY = "adminConsoleConfig";
const ADMIN_AUDIT_LOG_STATE_KEY = "adminAuditLog";
const DEFAULT_STALE_LOBBY_DAYS = 7;
const DEFAULT_AUDIT_LOG_LIMIT = 120;

function safeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function publicUserRole(user: PublicUser | null | undefined): "admin" | "user" {
  return user?.role === "admin" ? "admin" : "user";
}

function toPublicUser(
  auth: AdminConsoleOptions["auth"],
  user: StoredUser | null | undefined
): PublicUser {
  return (
    auth.publicUser(user) || {
      id: String(user?.id || ""),
      username: String(user?.username || ""),
      role: user?.role === "admin" ? "admin" : "user",
      hasEmail: false,
      authMethods: [],
      preferences: {
        theme:
          typeof user?.profile?.preferences?.theme === "string"
            ? user.profile.preferences.theme
            : null
      }
    }
  );
}

function normalizeMaintenanceConfig(input: unknown): AdminConfigRecord["maintenance"] {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const staleLobbyDays = Number(source.staleLobbyDays);
  const auditLogLimit = Number(source.auditLogLimit);

  return {
    staleLobbyDays:
      Number.isInteger(staleLobbyDays) && staleLobbyDays >= 1 && staleLobbyDays <= 365
        ? staleLobbyDays
        : DEFAULT_STALE_LOBBY_DAYS,
    auditLogLimit:
      Number.isInteger(auditLogLimit) && auditLogLimit >= 10 && auditLogLimit <= 500
        ? auditLogLimit
        : DEFAULT_AUDIT_LOG_LIMIT
  };
}

function normalizeAuditEntries(raw: unknown): AdminAuditEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object")
    )
    .map((entry) => ({
      id: asNonEmptyString(entry.id) || crypto.randomBytes(8).toString("hex"),
      actorId: asNonEmptyString(entry.actorId) || "unknown",
      actorUsername: asNonEmptyString(entry.actorUsername) || "unknown",
      action: asNonEmptyString(entry.action) || "unknown",
      targetType: asNonEmptyString(entry.targetType) || "unknown",
      targetId: asNonEmptyString(entry.targetId),
      targetLabel: asNonEmptyString(entry.targetLabel),
      result: entry.result === "failure" ? ("failure" as const) : ("success" as const),
      createdAt: asNonEmptyString(entry.createdAt) || new Date().toISOString(),
      details:
        entry.details && typeof entry.details === "object"
          ? (safeClone(entry.details) as Record<string, unknown>)
          : null
    }))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function gameUsesUser(game: RawGameRecord, user: StoredUser): boolean {
  return asArray(game?.state?.players).some((player) => {
    if (!player || player.isAi) {
      return false;
    }

    if (player.linkedUserId) {
      return player.linkedUserId === user.id;
    }

    return player.name === user.username;
  });
}

function gameWonByUser(game: RawGameRecord, user: StoredUser): boolean {
  const winnerId = asNonEmptyString(game?.state?.winnerId);
  if (!winnerId) {
    return false;
  }

  return asArray(game?.state?.players).some(
    (player) => player?.id === winnerId && player?.name === user.username
  );
}

function territoryCountForPlayer(state: GameState, playerId: string | null | undefined): number {
  if (!playerId) {
    return 0;
  }

  return Object.values(state?.territories || {}).filter(
    (territory) => territory?.ownerId === playerId
  ).length;
}

function cardCountForPlayer(state: GameState, playerId: string | null | undefined): number {
  if (!playerId) {
    return 0;
  }

  return Array.isArray(state?.hands?.[playerId]) ? state.hands[playerId].length : 0;
}

function isStale(updatedAt: string | null | undefined, staleLobbyDays: number): boolean {
  const parsed = new Date(String(updatedAt || ""));
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const ageMs = Date.now() - parsed.getTime();
  return ageMs > staleLobbyDays * 24 * 60 * 60 * 1000;
}

function ensureGameConfig(state: GameState): Record<string, unknown> {
  return state?.gameConfig && typeof state.gameConfig === "object"
    ? (state.gameConfig as Record<string, unknown>)
    : {};
}

function normalizeGameStateForRepair(state: GameState): GameState {
  migrateGameStateExtensions(state);
  const gameConfig = ensureGameConfig(state);

  if (asNonEmptyString(gameConfig.contentPackId)) {
    state.contentPackId = gameConfig.contentPackId;
  }

  if (asNonEmptyString(gameConfig.diceRuleSetId)) {
    state.diceRuleSetId = gameConfig.diceRuleSetId;
  }

  if (asNonEmptyString(gameConfig.victoryRuleSetId)) {
    state.victoryRuleSetId = gameConfig.victoryRuleSetId;
  }

  if (asNonEmptyString(gameConfig.pieceSetId)) {
    state.pieceSetId = gameConfig.pieceSetId;
  }

  if (asNonEmptyString(gameConfig.mapId)) {
    state.mapId = gameConfig.mapId;
  }

  if (asNonEmptyString(gameConfig.mapName)) {
    state.mapName = gameConfig.mapName;
  }

  return state;
}

async function maybeResolve<T>(value: Promise<T> | T): Promise<T> {
  return value;
}

function createAdminConsole(options: AdminConsoleOptions) {
  async function resolveAdminDefaults(input: Record<string, unknown> = {}) {
    const configured = await maybeResolve(
      options.createConfiguredInitialState(input, {
        resolveContentPack: (contentPackId: string) =>
          options.moduleRuntime.findContentPack(contentPackId),
        resolveDiceRuleSet: (diceRuleSetId: string) =>
          options.moduleRuntime.findDiceRuleSet(diceRuleSetId),
        resolvePlayerPieceSet: (pieceSetId: string) =>
          options.moduleRuntime.findPlayerPieceSet(pieceSetId),
        resolveSupportedMap: (mapId: string) => options.moduleRuntime.findSupportedMap(mapId),
        resolveGamePreset: (presetInput: Record<string, unknown>) =>
          options.moduleRuntime.resolveGamePreset(presetInput),
        resolveGameModuleConfigDefaults: (selectionInput: Record<string, unknown>) =>
          options.moduleRuntime.resolveGameConfigDefaults(selectionInput),
        resolveGameModuleSelection: (selectionInput: Record<string, unknown>) =>
          options.moduleRuntime.resolveGameSelection(selectionInput)
      })
    );

    const gameConfig = ensureGameConfig(configured.state);
    const activeModules = asArray(gameConfig.activeModules as Array<{ id?: string }> | null);
    const players = asArray(gameConfig.players as Array<Record<string, unknown>> | null).map(
      (player) => ({
        slot: typeof player.slot === "number" ? player.slot : null,
        type: typeof player.type === "string" ? player.type : null,
        name: typeof player.name === "string" ? player.name : null
      })
    );

    return {
      totalPlayers:
        typeof gameConfig.totalPlayers === "number" && Number.isInteger(gameConfig.totalPlayers)
          ? Number(gameConfig.totalPlayers)
          : null,
      contentPackId: asNonEmptyString(gameConfig.contentPackId),
      ruleSetId: asNonEmptyString(gameConfig.ruleSetId),
      mapId: asNonEmptyString(gameConfig.mapId),
      diceRuleSetId: asNonEmptyString(gameConfig.diceRuleSetId),
      victoryRuleSetId: asNonEmptyString(gameConfig.victoryRuleSetId),
      pieceSetId: asNonEmptyString(gameConfig.pieceSetId),
      themeId: asNonEmptyString(gameConfig.themeId),
      pieceSkinId: asNonEmptyString(gameConfig.pieceSkinId),
      gamePresetId: asNonEmptyString(gameConfig.gamePresetId),
      activeModuleIds: activeModules
        .map((entry) => asNonEmptyString(entry?.id))
        .filter((value): value is string => Boolean(value)),
      contentProfileId: asNonEmptyString(gameConfig.contentProfileId),
      gameplayProfileId: asNonEmptyString(gameConfig.gameplayProfileId),
      uiProfileId: asNonEmptyString(gameConfig.uiProfileId),
      turnTimeoutHours:
        typeof gameConfig.turnTimeoutHours === "number" &&
        Number.isInteger(gameConfig.turnTimeoutHours)
          ? Number(gameConfig.turnTimeoutHours)
          : null,
      players
    };
  }

  async function readConfigSource(): Promise<Record<string, unknown>> {
    const raw = await maybeResolve(options.datastore.getAppState(ADMIN_CONFIG_STATE_KEY));
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  }

  async function loadConfigRecord(): Promise<AdminConfigRecord> {
    const source = await readConfigSource();
    const defaults = await resolveAdminDefaults(
      source.defaults && typeof source.defaults === "object"
        ? (source.defaults as Record<string, unknown>)
        : {}
    );
    const updatedBySource =
      source.updatedBy && typeof source.updatedBy === "object"
        ? (source.updatedBy as StoredUser | PublicUser)
        : null;

    return {
      defaults,
      maintenance: normalizeMaintenanceConfig(source.maintenance),
      updatedAt: asNonEmptyString(source.updatedAt),
      updatedBy: updatedBySource ? toPublicUser(options.auth, updatedBySource as StoredUser) : null
    };
  }

  async function saveConfigRecord(record: AdminConfigRecord): Promise<AdminConfigRecord> {
    await maybeResolve(
      options.datastore.setAppState(ADMIN_CONFIG_STATE_KEY, {
        defaults: safeClone(record.defaults),
        maintenance: safeClone(record.maintenance),
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy
      })
    );

    return loadConfigRecord();
  }

  async function listAuditEntries(limit?: number): Promise<AdminAuditEntry[]> {
    const config = await loadConfigRecord();
    const entries = normalizeAuditEntries(
      await maybeResolve(options.datastore.getAppState(ADMIN_AUDIT_LOG_STATE_KEY))
    );
    const maxItems =
      Number.isInteger(limit) && Number(limit) > 0
        ? Number(limit)
        : config.maintenance.auditLogLimit;
    return entries.slice(0, maxItems);
  }

  async function recordAudit(input: {
    actor: PublicUser;
    action: string;
    targetType: string;
    targetId?: string | null;
    targetLabel?: string | null;
    result: "success" | "failure";
    details?: Record<string, unknown> | null;
  }): Promise<AdminAuditEntry> {
    const config = await loadConfigRecord();
    const entries = normalizeAuditEntries(
      await maybeResolve(options.datastore.getAppState(ADMIN_AUDIT_LOG_STATE_KEY))
    );
    const entry: AdminAuditEntry = {
      id: crypto.randomBytes(8).toString("hex"),
      actorId: input.actor.id,
      actorUsername: input.actor.username,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      targetLabel: input.targetLabel || null,
      result: input.result,
      createdAt: new Date().toISOString(),
      details: input.details ? safeClone(input.details) : null
    };
    const nextEntries = [entry, ...entries].slice(0, config.maintenance.auditLogLimit);
    await maybeResolve(options.datastore.setAppState(ADMIN_AUDIT_LOG_STATE_KEY, nextEntries));
    return entry;
  }

  async function recordAuditSafely(input: {
    actor: PublicUser;
    action: string;
    targetType: string;
    targetId?: string | null;
    targetLabel?: string | null;
    result: "success" | "failure";
    details?: Record<string, unknown> | null;
  }): Promise<AdminAuditEntry> {
    try {
      return await recordAudit(input);
    } catch (error) {
      console.error("Failed to persist admin audit entry:", error);
      return {
        id: crypto.randomBytes(8).toString("hex"),
        actorId: input.actor.id,
        actorUsername: input.actor.username,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId || null,
        targetLabel: input.targetLabel || null,
        result: input.result,
        createdAt: new Date().toISOString(),
        details: input.details ? safeClone(input.details) : null
      };
    }
  }

  async function rawGamesById(): Promise<Map<string, RawGameRecord>> {
    const entries = asArray(await maybeResolve(options.gameSessions.datastore.listGames()));
    return new Map(entries.map((entry) => [entry.id, entry]));
  }

  async function collectGameIssues(
    summary: GameSummary,
    rawGame: RawGameRecord | null,
    staleLobbyDays: number
  ): Promise<AdminIssue[]> {
    const issues: AdminIssue[] = [];
    const state = rawGame?.state || ({ players: [], territories: {}, hands: {} } as GameState);
    const config = ensureGameConfig(state);
    const installedModules = await options.moduleRuntime.listInstalledModules();
    const installedById = new Map(
      installedModules.map((moduleEntry) => [String(moduleEntry.id || ""), moduleEntry])
    );
    const activeModules = asArray(summary.activeModules);

    if (summary.phase === "lobby" && isStale(summary.updatedAt, staleLobbyDays)) {
      issues.push({
        code: "stale-lobby",
        severity: "warning",
        message: `Lobby "${summary.name}" inattiva da oltre ${staleLobbyDays} giorni.`,
        gameId: summary.id,
        actionId: "cleanup-stale-lobbies"
      });
    }

    activeModules.forEach((moduleRef) => {
      const moduleEntry = installedById.get(moduleRef.id);
      if (!moduleEntry) {
        issues.push({
          code: "orphaned-module-reference",
          severity: "error",
          message: `La partita riferisce il modulo mancante "${moduleRef.id}".`,
          gameId: summary.id
        });
        return;
      }

      if (!moduleEntry.enabled || !moduleEntry.compatible) {
        issues.push({
          code: "disabled-module-reference",
          severity: "error",
          message: `La partita dipende dal modulo non disponibile "${moduleRef.id}".`,
          gameId: summary.id
        });
      }
    });

    const mapId = asNonEmptyString(config.mapId);
    if (mapId && !options.moduleRuntime.findSupportedMap(mapId)) {
      issues.push({
        code: "missing-map",
        severity: "error",
        message: `La configurazione usa la mappa non risolta "${mapId}".`,
        gameId: summary.id
      });
    }

    const contentPackId = asNonEmptyString(config.contentPackId);
    if (contentPackId && !options.moduleRuntime.findContentPack(contentPackId)) {
      issues.push({
        code: "missing-content-pack",
        severity: "error",
        message: `La configurazione usa il content pack non risolto "${contentPackId}".`,
        gameId: summary.id
      });
    }

    const diceRuleSetId = asNonEmptyString(config.diceRuleSetId);
    if (diceRuleSetId && !options.moduleRuntime.findDiceRuleSet(diceRuleSetId)) {
      issues.push({
        code: "missing-dice-rule-set",
        severity: asNonEmptyString(config.diceRuleSetName) ? "warning" : "error",
        message: `La configurazione usa il rule set dadi non risolto "${diceRuleSetId}".`,
        gameId: summary.id
      });
    }

    const themeId = asNonEmptyString(config.themeId);
    if (themeId && !findVisualTheme(themeId)) {
      issues.push({
        code: "missing-theme",
        severity: "error",
        message: `La configurazione usa il tema non supportato "${themeId}".`,
        gameId: summary.id
      });
    }

    const pieceSkinId = asNonEmptyString(config.pieceSkinId);
    if (pieceSkinId && !findPieceSkin(pieceSkinId)) {
      issues.push({
        code: "missing-piece-skin",
        severity: "error",
        message: `La configurazione usa la skin pedine non supportata "${pieceSkinId}".`,
        gameId: summary.id
      });
    }

    const victoryRuleSetId = asNonEmptyString(config.victoryRuleSetId);
    if (victoryRuleSetId && !findVictoryRuleSet(victoryRuleSetId)) {
      issues.push({
        code: "missing-victory-rule-set",
        severity: "error",
        message: `La configurazione usa la regola vittoria non supportata "${victoryRuleSetId}".`,
        gameId: summary.id
      });
    }

    if (summary.phase === "active" && (!Array.isArray(state.players) || !state.players.length)) {
      issues.push({
        code: "active-game-without-players",
        severity: "error",
        message: `La partita attiva "${summary.name}" non ha giocatori validi.`,
        gameId: summary.id
      });
    }

    if (
      summary.phase === "active" &&
      Array.isArray(state.players) &&
      state.players.length > 0 &&
      (!Number.isInteger(state.currentTurnIndex) ||
        Number(state.currentTurnIndex) < 0 ||
        Number(state.currentTurnIndex) >= state.players.length)
    ) {
      issues.push({
        code: "invalid-turn-index",
        severity: "warning",
        message: `La partita attiva "${summary.name}" ha un currentTurnIndex non valido.`,
        gameId: summary.id
      });
    }

    if (
      typeof summary.totalPlayers === "number" &&
      Number.isInteger(summary.totalPlayers) &&
      summary.totalPlayers > 0 &&
      summary.playerCount > summary.totalPlayers
    ) {
      issues.push({
        code: "player-count-exceeds-config",
        severity: "warning",
        message: `La lobby "${summary.name}" ha piu giocatori dello slot configurato.`,
        gameId: summary.id
      });
    }

    return issues;
  }

  async function summarizeAdminGame(
    summary: GameSummary,
    rawGame: RawGameRecord | null,
    staleLobbyDays: number
  ) {
    const issues = await collectGameIssues(summary, rawGame, staleLobbyDays);
    return {
      ...summary,
      stale: summary.phase === "lobby" && isStale(summary.updatedAt, staleLobbyDays),
      health: issues.some((issue) => issue.severity === "error")
        ? "error"
        : issues.some((issue) => issue.severity === "warning")
          ? "warning"
          : "ok",
      issueCount: issues.length,
      issues
    };
  }

  function buildPlayerSummaries(state: GameState) {
    return asArray(state.players).map((player) => ({
      id: String(player?.id || ""),
      name: String(player?.name || "Unknown"),
      linkedUserId: asNonEmptyString(player?.linkedUserId),
      isAi: Boolean(player?.isAi),
      surrendered: Boolean(player?.surrendered),
      territoryCount: territoryCountForPlayer(state, player?.id),
      cardCount: cardCountForPlayer(state, player?.id)
    }));
  }

  async function getOverview() {
    const [users, games, config, enabledModules, audit] = await Promise.all([
      maybeResolve(options.datastore.listUsers()),
      maybeResolve(options.gameSessions.listGames()),
      loadConfigRecord(),
      options.moduleRuntime.getEnabledModules(),
      listAuditEntries(8)
    ]);
    const rawById = await rawGamesById();
    const enrichedGames = await Promise.all(
      asArray(games).map((game) =>
        summarizeAdminGame(game, rawById.get(game.id) || null, config.maintenance.staleLobbyDays)
      )
    );

    return {
      summary: {
        totalUsers: asArray(users).length,
        adminUsers: asArray(users).filter((user) => user?.role === "admin").length,
        activeGames: enrichedGames.filter((game) => game.phase === "active").length,
        lobbyGames: enrichedGames.filter((game) => game.phase === "lobby").length,
        finishedGames: enrichedGames.filter((game) => game.phase === "finished").length,
        staleLobbies: enrichedGames.filter((game) => game.stale).length,
        invalidGames: enrichedGames.filter((game) => game.health === "error").length,
        enabledModules: enabledModules.length
      },
      config,
      recentGames: enrichedGames.slice(0, 6),
      issues: enrichedGames
        .flatMap((game) => game.issues)
        .sort((left, right) => left.severity.localeCompare(right.severity))
        .slice(0, 8),
      audit
    };
  }

  async function listUsers(filters: { query?: string | null; role?: string | null } = {}) {
    const [users, rawGames] = await Promise.all([
      maybeResolve(options.datastore.listUsers()),
      maybeResolve(options.gameSessions.datastore.listGames())
    ]);
    const total = asArray(users).length;
    const normalizedQuery = String(filters.query || "")
      .trim()
      .toLowerCase();
    const requestedRole = asNonEmptyString(filters.role);
    const adminCount = asArray(users).filter((user) => user?.role === "admin").length;

    const summaries = asArray(users)
      .map((user) => {
        const participatingGames = asArray(rawGames).filter((game) => gameUsesUser(game, user));
        const completedGames = participatingGames.filter(
          (game) => game?.state?.phase === "finished"
        );
        const wins = completedGames.filter((game) => gameWonByUser(game, user)).length;
        const publicUser = toPublicUser(options.auth, user);
        const role = publicUserRole(publicUser);
        const canPromote = role !== "admin";
        const canDemote = role === "admin" && adminCount > 1;

        return {
          ...publicUser,
          role,
          createdAt: String(user?.createdAt || new Date().toISOString()),
          gamesPlayed: completedGames.length,
          gamesInProgress: participatingGames.filter(
            (game) => game?.state?.phase === "active" || game?.state?.phase === "lobby"
          ).length,
          wins,
          canPromote,
          canDemote
        };
      })
      .filter((user) => {
        if (requestedRole && user.role !== requestedRole) {
          return false;
        }

        if (normalizedQuery) {
          return user.username.toLowerCase().includes(normalizedQuery);
        }

        return true;
      })
      .sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === "admin" ? -1 : 1;
        }

        return left.username.localeCompare(right.username);
      });

    return {
      users: summaries,
      total,
      filteredTotal: summaries.length,
      query: String(filters.query || ""),
      role: requestedRole
    };
  }

  async function updateUserRole(
    actor: PublicUser,
    input: { userId: string; role: "admin" | "user" }
  ) {
    const targetUser = await maybeResolve(options.datastore.findUserById(input.userId));
    if (!targetUser) {
      throw new Error(`Utente "${input.userId}" non trovato.`);
    }

    const users = asArray(await maybeResolve(options.datastore.listUsers()));
    const adminUsers = users.filter((user) => user?.role === "admin");
    if (targetUser.role === "admin" && input.role === "user" && adminUsers.length <= 1) {
      throw new Error("Impossibile rimuovere l'ultimo amministratore disponibile.");
    }

    await maybeResolve(options.datastore.updateUserRoleByUsername(targetUser.username, input.role));
    const refreshedUsers = await listUsers();
    const updatedUser = refreshedUsers.users.find((user) => user.id === input.userId);
    if (!updatedUser) {
      throw new Error(`Utente "${input.userId}" aggiornato ma non ricaricabile.`);
    }

    const audit = await recordAuditSafely({
      actor,
      action: "user.role.update",
      targetType: "user",
      targetId: updatedUser.id,
      targetLabel: updatedUser.username,
      result: "success",
      details: {
        role: updatedUser.role
      }
    });

    return {
      ok: true,
      user: updatedUser,
      audit
    };
  }

  async function listGames(filters: { query?: string | null; status?: string | null } = {}) {
    const config = await loadConfigRecord();
    const [games, rawById] = await Promise.all([
      maybeResolve(options.gameSessions.listGames()),
      rawGamesById()
    ]);
    const requestedStatus = asNonEmptyString(filters.status);
    const normalizedQuery = String(filters.query || "")
      .trim()
      .toLowerCase();
    const total = asArray(games).length;

    const enrichedGames = (
      await Promise.all(
        asArray(games).map((game) =>
          summarizeAdminGame(game, rawById.get(game.id) || null, config.maintenance.staleLobbyDays)
        )
      )
    ).filter((game) => {
      if (requestedStatus && game.phase !== requestedStatus) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        game.name.toLowerCase().includes(normalizedQuery) ||
        String(game.id).toLowerCase().includes(normalizedQuery)
      );
    });

    return {
      games: enrichedGames,
      total,
      filteredTotal: enrichedGames.length,
      status: requestedStatus,
      query: String(filters.query || "")
    };
  }

  async function getGameDetails(gameId: string) {
    const config = await loadConfigRecord();
    const record = await maybeResolve(options.gameSessions.getGame(gameId));
    const summary = await summarizeAdminGame(
      record.game,
      {
        id: record.game.id,
        name: record.game.name,
        version: record.game.version,
        creatorUserId: record.game.creatorUserId || null,
        state: safeClone(record.state),
        createdAt: record.game.createdAt || new Date().toISOString(),
        updatedAt: record.game.updatedAt
      },
      config.maintenance.staleLobbyDays
    );

    return {
      game: summary,
      players: buildPlayerSummaries(record.state),
      rawState: safeClone(record.state)
    };
  }

  function requireConfirmation(gameId: string, confirmation: string | null | undefined) {
    if (String(confirmation || "").trim() !== String(gameId || "").trim()) {
      throw new Error(`Conferma richiesta: inserisci ${gameId} per procedere.`);
    }
  }

  async function performGameAction(
    actor: PublicUser,
    input: {
      gameId: string;
      action: "close-lobby" | "terminate-game" | "repair-game-config";
      confirmation?: string | null;
    }
  ) {
    const gameContext = await options.loadGameContext(input.gameId);
    if (!gameContext?.gameId) {
      throw new Error(`Partita "${input.gameId}" non trovata.`);
    }

    const nextState = safeClone(gameContext.state);
    const beforeState = JSON.stringify(nextState);
    const now = new Date().toISOString();

    if (input.action === "close-lobby") {
      requireConfirmation(input.gameId, input.confirmation);
      if (nextState.phase !== "lobby") {
        throw new Error("Solo le lobby possono essere chiuse manualmente.");
      }
      nextState.phase = "finished";
    } else if (input.action === "terminate-game") {
      requireConfirmation(input.gameId, input.confirmation);
      if (nextState.phase !== "active") {
        throw new Error("Solo le partite attive possono essere terminate.");
      }
      nextState.phase = "finished";
    } else {
      normalizeGameStateForRepair(nextState);
    }

    nextState.adminMeta = {
      ...(nextState.adminMeta && typeof nextState.adminMeta === "object"
        ? (nextState.adminMeta as Record<string, unknown>)
        : {}),
      lastAction: input.action,
      actedAt: now,
      actedBy: {
        id: actor.id,
        username: actor.username
      }
    };

    const changed = JSON.stringify(nextState) !== beforeState;
    const nextContext: GameContext = {
      ...gameContext,
      state: nextState
    };

    if (changed) {
      await options.persistGameContext(nextContext, gameContext.version);
      options.broadcastGame(nextContext);
    }

    const detail = await getGameDetails(input.gameId);
    const audit = await recordAuditSafely({
      actor,
      action: `game.${input.action}`,
      targetType: "game",
      targetId: detail.game.id,
      targetLabel: detail.game.name,
      result: "success",
      details: {
        changed
      }
    });

    return {
      ok: true,
      ...detail,
      audit
    };
  }

  async function getConfig() {
    return {
      config: await loadConfigRecord()
    };
  }

  async function updateConfig(
    actor: PublicUser,
    input: {
      defaults?: Record<string, unknown>;
      maintenance?: Record<string, unknown>;
    }
  ) {
    const currentConfigSource = await readConfigSource();
    const defaults = await resolveAdminDefaults(
      input.defaults && typeof input.defaults === "object"
        ? (input.defaults as Record<string, unknown>)
        : currentConfigSource.defaults && typeof currentConfigSource.defaults === "object"
          ? (currentConfigSource.defaults as Record<string, unknown>)
          : {}
    );
    const maintenance = input.maintenance
      ? normalizeMaintenanceConfig(input.maintenance)
      : normalizeMaintenanceConfig(currentConfigSource.maintenance);
    const savedConfig = await saveConfigRecord({
      defaults,
      maintenance,
      updatedAt: new Date().toISOString(),
      updatedBy: actor
    });
    const audit = await recordAuditSafely({
      actor,
      action: "config.update",
      targetType: "config",
      targetId: "global",
      targetLabel: "Global defaults",
      result: "success",
      details: {
        defaults,
        maintenance
      }
    });

    return {
      ok: true,
      config: savedConfig,
      audit
    };
  }

  async function getMaintenanceReport() {
    const config = await loadConfigRecord();
    const [games, rawById] = await Promise.all([
      maybeResolve(options.gameSessions.listGames()),
      rawGamesById()
    ]);
    const enrichedGames = await Promise.all(
      asArray(games).map((game) =>
        summarizeAdminGame(game, rawById.get(game.id) || null, config.maintenance.staleLobbyDays)
      )
    );
    const issues = enrichedGames.flatMap((game) => game.issues);

    return {
      summary: {
        totalGames: enrichedGames.length,
        staleLobbies: enrichedGames.filter((game) => game.stale).length,
        invalidGames: enrichedGames.filter((game) => game.health === "error").length,
        orphanedModuleReferences: issues.filter(
          (issue) =>
            issue.code === "orphaned-module-reference" || issue.code === "disabled-module-reference"
        ).length
      },
      issues
    };
  }

  async function runMaintenanceAction(
    actor: PublicUser,
    input: {
      action: "validate-all" | "cleanup-stale-lobbies";
      confirmation?: string | null;
    }
  ) {
    if (input.action === "validate-all") {
      const report = await getMaintenanceReport();
      const audit = await recordAuditSafely({
        actor,
        action: "maintenance.validate-all",
        targetType: "maintenance",
        targetId: "validate-all",
        targetLabel: "Validation report",
        result: "success",
        details: {
          issues: report.issues.length
        }
      });

      return {
        ok: true,
        report,
        affectedGameIds: [],
        audit
      };
    }

    if (String(input.confirmation || "").trim() !== "cleanup-stale-lobbies") {
      throw new Error("Conferma richiesta: inserisci cleanup-stale-lobbies per procedere.");
    }

    const config = await loadConfigRecord();
    const games = await listGames({ status: "lobby" });
    const staleGames = games.games.filter(
      (game) => game.stale || game.issues.some((issue) => issue.code === "stale-lobby")
    );
    const affectedGameIds: string[] = [];

    for (const game of staleGames) {
      const context = await options.loadGameContext(game.id);
      if (!context?.gameId) {
        continue;
      }

      if (String(context.state?.phase || "") !== "lobby") {
        continue;
      }

      const nextState = safeClone(context.state);
      nextState.phase = "finished";
      nextState.adminMeta = {
        ...(nextState.adminMeta && typeof nextState.adminMeta === "object"
          ? (nextState.adminMeta as Record<string, unknown>)
          : {}),
        lastAction: "cleanup-stale-lobbies",
        actedAt: new Date().toISOString(),
        actedBy: {
          id: actor.id,
          username: actor.username
        }
      };

      await options.persistGameContext(
        {
          ...context,
          state: nextState
        },
        context.version
      );
      options.broadcastGame({
        ...context,
        state: nextState
      });
      affectedGameIds.push(game.id);
    }

    const report = await getMaintenanceReport();
    const audit = await recordAuditSafely({
      actor,
      action: "maintenance.cleanup-stale-lobbies",
      targetType: "maintenance",
      targetId: "cleanup-stale-lobbies",
      targetLabel: "Stale lobby cleanup",
      result: "success",
      details: {
        staleLobbyDays: config.maintenance.staleLobbyDays,
        affectedGameIds
      }
    });

    return {
      ok: true,
      report,
      affectedGameIds,
      audit
    };
  }

  async function listAudit() {
    return {
      entries: await listAuditEntries()
    };
  }

  async function assertModuleSafeToDisable(moduleId: string) {
    const config = await loadConfigRecord();
    const activeModuleIds = asArray(config.defaults.activeModuleIds as string[] | undefined);
    if (activeModuleIds.includes(moduleId)) {
      throw new Error(`Module "${moduleId}" is still referenced by admin defaults.`);
    }
  }

  return {
    getOverview,
    listUsers,
    updateUserRole,
    listGames,
    getGameDetails,
    performGameAction,
    getConfig,
    updateConfig,
    getMaintenanceReport,
    runMaintenanceAction,
    listAudit,
    recordAudit,
    assertModuleSafeToDisable,
    loadConfigRecord
  };
}

module.exports = {
  ADMIN_AUDIT_LOG_STATE_KEY,
  ADMIN_CONFIG_STATE_KEY,
  createAdminConsole,
  normalizeGameStateForRepair
};
