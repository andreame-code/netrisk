import type { CSSProperties, ReactNode } from "react";

import type {
  GameSnapshot,
  SnapshotCard,
  SnapshotLastCombat,
  SnapshotPlayer,
  SnapshotTerritory
} from "@frontend-generated/shared-runtime-validation.mts";

import { t } from "@frontend-i18n";

import { WarTableIcon, type WarTableIconName } from "@react-shell/war-table-icons";

export type GameDrawerKey = "players" | "cards" | "gameInfo";
export type ActivityLogFilter = "all" | "combat" | "cards" | "turn";

export type ActivityLogEntry = {
  category: Exclude<ActivityLogFilter, "all">;
  text: string;
  time?: string;
};

export type GameActionItem = {
  badge?: number;
  drawer: GameDrawerKey;
  icon: WarTableIconName;
  label: string;
};

type GameHudProps = {
  activePlayerInitial: string;
  activePlayerName: string;
  feedbackMessage: string;
  feedbackIsError: boolean;
  mustTradeCards: boolean;
  phaseBadgeLabel: string;
  reinforcementPool: number;
  tradeAlertText: string;
  winnerName?: string;
};

type CombatResultPanelProps = {
  lastCombat: SnapshotLastCombat | null | undefined;
  playersById: Record<string, SnapshotPlayer>;
  territoriesById: Record<string, SnapshotTerritory>;
};

type GameActionRailProps = {
  activeDrawer: GameDrawerKey | null;
  items: GameActionItem[];
  onToggleDrawer(drawer: GameDrawerKey): void;
};

type GameDrawerShellProps = {
  children: ReactNode;
  className?: string;
  side?: "left" | "right";
  title: string;
  eyebrow?: string;
  onClose(): void;
};

type PlayersDrawerProps = {
  currentPlayerId: string | null | undefined;
  myPlayerId: string | null;
  onClose(): void;
  players: SnapshotPlayer[];
  territories: SnapshotTerritory[];
};

type CardsDrawerProps = {
  canTradeCards: boolean;
  cardState: GameSnapshot["cardState"];
  cards: SnapshotCard[];
  getCardTypeLabel(card: SnapshotCard): string;
  mustTradeCards: boolean;
  onClose(): void;
  onTradeCards(): void;
  onToggleCard(cardId: string): void;
  selectedCardIds: string[];
  trading: boolean;
};

type GameInfoDrawerProps = {
  accessStatusLabel: string;
  enabledModules: string[];
  gameId: string;
  gameStatusLabel: string;
  mapMetaLabel: string;
  meName: string;
  onClose(): void;
  onSurrender(): void;
  setupMetaLabel: string;
  showSurrender: boolean;
  surrenderDisabled: boolean;
  version: number | undefined;
};

type ActivityLogDrawerProps = {
  entries: ActivityLogEntry[];
  filter: ActivityLogFilter;
  isCleared: boolean;
  onClear(): void;
  onClose(): void;
  onFilterChange(filter: ActivityLogFilter): void;
};

type GameActionDockProps = {
  children: ReactNode;
  className?: string;
  commandTitle: string;
  expanded: boolean;
  mode: "attack" | "reinforcement" | "fortify" | "conquest" | "lobby" | "idle" | "mandatory-trade";
  onToggleExpanded(): void;
};

function playerTroopCount(playerId: string, territories: SnapshotTerritory[]): number {
  return territories
    .filter((territory) => territory.ownerId === playerId)
    .reduce((total, territory) => total + Number(territory.armies || 0), 0);
}

function cardSymbol(card: SnapshotCard): string {
  if (card.type === "artillery") {
    return "C";
  }

  if (card.type === "cavalry") {
    return "H";
  }

  if (card.type === "wild") {
    return "*";
  }

  return "I";
}

function cardTone(card: SnapshotCard): string {
  if (card.type === "artillery") {
    return "artillery";
  }

  if (card.type === "cavalry") {
    return "cavalry";
  }

  if (card.type === "wild") {
    return "wild";
  }

  return "infantry";
}

function combatBadgeLabel(lastCombat: SnapshotLastCombat): string {
  if (lastCombat.conqueredTerritory) {
    return t("game.runtime.combat.conquered");
  }

  if (lastCombat.defenderReducedToZero) {
    return t("game.runtime.combat.defenseBroken");
  }

  return t("game.runtime.combat.resolved");
}

function formatDiceRolls(rolls: number[] | undefined): string {
  return rolls?.length ? rolls.join(" · ") : "-";
}

function formatLegacyDiceRolls(rolls: number[] | undefined): string {
  return rolls?.length ? rolls.join(", ") : "-";
}

function formatCombatComparisons(lastCombat: SnapshotLastCombat): string {
  const comparisons = lastCombat.comparisons || [];
  if (!comparisons.length) {
    return "-";
  }

  return comparisons
    .map((comparison) => {
      if (comparison.winner === "attacker") {
        return "A";
      }

      if (comparison.winner === "defender") {
        return "D";
      }

      return `${comparison.attackDie ?? "-"}:${comparison.defendDie ?? "-"}`;
    })
    .join(" · ");
}

function categoryLabel(filter: ActivityLogFilter): string {
  if (filter === "combat") {
    return t("game.activityFilter.combat");
  }

  if (filter === "cards") {
    return t("game.activityFilter.cards");
  }

  if (filter === "turn") {
    return t("game.activityFilter.turn");
  }

  return t("game.activityFilter.all");
}

function categoryIcon(category: ActivityLogEntry["category"]): WarTableIconName {
  if (category === "cards") {
    return "cards";
  }

  if (category === "turn") {
    return "flag";
  }

  return "crosshair";
}

export function GameHud({
  activePlayerInitial,
  activePlayerName,
  feedbackMessage,
  feedbackIsError,
  mustTradeCards,
  phaseBadgeLabel,
  reinforcementPool,
  tradeAlertText,
  winnerName
}: GameHudProps) {
  return (
    <section
      className="panel game-info-rail game-info-bottom game-floating-hud campaign-shell"
      data-testid="info-panel"
      aria-label={t("game.command.heading")}
    >
      <div className="panel-header tight-header game-compact-heading game-hud-heading">
        <div>
          <h1>
            {t("game.hud.phase")}: {phaseBadgeLabel}
          </h1>
        </div>
        <span id="turn-badge" className="badge" data-testid="phase-indicator">
          {phaseBadgeLabel}
        </span>
      </div>

      <div
        id="trade-alert"
        className="turn-alert turn-alert-danger map-trade-alert"
        hidden={!mustTradeCards}
      >
        <strong>{t("game.tradeAlert.title")}</strong>
        <span id="trade-alert-text">{tradeAlertText}</span>
      </div>

      <div
        id="status-summary"
        className="status-summary command-summary map-command-summary game-hud-summary"
        data-testid="status-summary"
      >
        <span className="game-visually-hidden">
          {t("game.reinforcementBanner")} {reinforcementPool}
        </span>
        <div className="game-hud-stat">
          <span className="game-hud-icon game-hud-icon-reinforcements" aria-hidden="true">
            <WarTableIcon name="soldier" />
          </span>
          <span>
            <span className="game-hud-label">
              <span className="game-visually-hidden">{t("game.reinforcementBanner")}</span>
              {t("game.hud.reinforcements")}
            </span>
            <strong>{reinforcementPool}</strong>
          </span>
        </div>
        <div className="game-hud-stat">
          <span className="game-hud-avatar" aria-hidden="true">
            {activePlayerInitial}
          </span>
          <span>
            <span className="game-hud-label">{t("game.hud.activePlayer")}</span>
            <strong>{activePlayerName}</strong>
          </span>
        </div>
        {winnerName ? (
          <div className="game-hud-stat">
            <span className="game-hud-icon" aria-hidden="true">
              <WarTableIcon name="medal" />
            </span>
            <span>
              <span className="game-hud-label">{t("game.runtime.winner")}</span>
              <strong>{winnerName}</strong>
            </span>
          </div>
        ) : null}
      </div>
      <div
        id="game-feedback"
        className={`action-help${feedbackIsError ? " is-error" : ""}`}
        data-testid="react-shell-game-feedback"
        hidden={!feedbackMessage}
      >
        {feedbackMessage}
      </div>
    </section>
  );
}

export function CombatResultPanel({
  lastCombat,
  playersById,
  territoriesById
}: CombatResultPanelProps) {
  if (!lastCombat) {
    return null;
  }

  const fromTerritoryName =
    territoriesById[lastCombat.fromTerritoryId]?.name || lastCombat.fromTerritoryId;
  const toTerritoryName =
    territoriesById[lastCombat.toTerritoryId]?.name || lastCombat.toTerritoryId;
  const attackerName = lastCombat.attackerPlayerId
    ? playersById[lastCombat.attackerPlayerId]?.name || lastCombat.attackerPlayerId
    : fromTerritoryName;
  const defenderName = lastCombat.defenderPlayerId
    ? playersById[lastCombat.defenderPlayerId]?.name || lastCombat.defenderPlayerId
    : toTerritoryName;
  const attackerRolls = formatDiceRolls(lastCombat.attackerRolls);
  const defenderRolls = formatDiceRolls(lastCombat.defenderRolls);
  const legacyAttackerRolls = formatLegacyDiceRolls(lastCombat.attackerRolls);
  const legacyDefenderRolls = formatLegacyDiceRolls(lastCombat.defenderRolls);
  const comparisonSummary = formatCombatComparisons(lastCombat);

  return (
    <aside
      id="combat-result-group"
      className="combat-result-section game-combat-result-panel"
      aria-live="polite"
    >
      <div className="section-title-row">
        <h3>{t("game.combat.heading")}</h3>
        <span id="combat-result-badge" className="badge">
          {combatBadgeLabel(lastCombat)}
        </span>
      </div>
      <p id="combat-result-summary" className="combat-result-summary">
        {fromTerritoryName}
        {" -> "}
        {toTerritoryName}
      </p>
      <div className="combat-result-grid">
        <div className="combat-result-line">
          <span>{t("game.combat.attacker")}</span>
          <strong id="combat-attacker-rolls">
            {attackerName} · {attackerRolls}
            <span className="game-visually-hidden" aria-hidden="true">
              {" "}
              {attackerName} · {legacyAttackerRolls}
            </span>
          </strong>
        </div>
        <div className="combat-result-line">
          <span>{t("game.combat.defender")}</span>
          <strong id="combat-defender-rolls">
            {defenderName} · {defenderRolls}
            <span className="game-visually-hidden" aria-hidden="true">
              {" "}
              {defenderName} · {legacyDefenderRolls}
            </span>
          </strong>
        </div>
        <div className="combat-result-line">
          <span>{t("game.combat.comparisons")}</span>
          <strong id="combat-comparisons">{comparisonSummary}</strong>
        </div>
      </div>
    </aside>
  );
}

export function GameActionRail({ activeDrawer, items, onToggleDrawer }: GameActionRailProps) {
  return (
    <nav className="game-action-rail" aria-label="Game panels">
      {items.map((item) => {
        const buttonClassName = `game-action-rail-button game-${item.drawer === "gameInfo" ? "info" : item.drawer}-drawer${activeDrawer === item.drawer ? " is-active" : ""}`;
        const content = (
          <>
            <span className="game-action-rail-icon" aria-hidden="true">
              <WarTableIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
            {typeof item.badge === "number" ? (
              <span className="game-action-badge">{item.badge}</span>
            ) : null}
          </>
        );

        if (item.drawer === "cards") {
          return (
            <details
              key={item.drawer}
              className={buttonClassName}
              open={activeDrawer === item.drawer}
            >
              <summary
                aria-pressed={activeDrawer === item.drawer}
                onClick={(event) => {
                  event.preventDefault();
                  onToggleDrawer(item.drawer);
                }}
              >
                {content}
              </summary>
            </details>
          );
        }

        return (
          <button
            key={item.drawer}
            type="button"
            className={buttonClassName}
            aria-pressed={activeDrawer === item.drawer}
            onClick={() => onToggleDrawer(item.drawer)}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}

export function GameDrawerShell({
  children,
  className = "",
  eyebrow,
  onClose,
  side = "left",
  title
}: GameDrawerShellProps) {
  return (
    <aside className={`game-modern-drawer game-modern-drawer-${side} ${className}`.trim()}>
      <header className="game-modern-drawer-header">
        <div>
          <h2>{title}</h2>
          {eyebrow ? <p>{eyebrow}</p> : null}
        </div>
        <button
          type="button"
          className="game-drawer-close"
          aria-label="Close panel"
          onClick={onClose}
        >
          x
        </button>
      </header>
      {children}
    </aside>
  );
}

export function PlayersDrawer({
  currentPlayerId,
  myPlayerId,
  onClose,
  players,
  territories
}: PlayersDrawerProps) {
  return (
    <GameDrawerShell
      title={t("game.players.heading").toUpperCase()}
      eyebrow={t("game.players.count", { count: players.length })}
      onClose={onClose}
      className="game-players-modern-drawer"
    >
      <div className="game-players-table" id="players-drawer-list">
        <div className="game-players-head">
          <span>{t("game.players.player")}</span>
          <span>{t("game.players.troops")}</span>
          <span>{t("game.runtime.territories")}</span>
        </div>
        {players.map((player) => {
          const isCurrent = player.id === currentPlayerId;
          const isMe = player.id === myPlayerId;
          const statusLabel = player.eliminated
            ? t("game.runtime.eliminated")
            : isCurrent
              ? t("game.players.currentTurn")
              : t("game.runtime.waiting");

          return (
            <article className="game-player-row" data-player-id={player.id} key={player.id}>
              <div className="game-player-identity">
                <span
                  className="game-player-color"
                  style={{ "--player-color": player.color || "#9aa6b2" } as CSSProperties}
                  aria-hidden="true"
                />
                <span>
                  <strong>
                    {player.name}
                    {isMe ? <em>{t("game.players.you")}</em> : null}
                  </strong>
                  <small className={isCurrent ? "is-current" : ""}>{statusLabel}</small>
                </span>
              </div>
              <strong>{playerTroopCount(player.id, territories)}</strong>
              <strong>{player.territoryCount || 0}</strong>
            </article>
          );
        })}
      </div>
      <footer className="game-drawer-callout">
        <WarTableIcon name="objective" />
        <span>
          <strong>
            {t("game.runtime.turnOf", {
              name:
                players.find((player) => player.id === currentPlayerId)?.name ||
                t("game.runtime.none")
            })}
          </strong>
          <small>{t("game.players.commandHint")}</small>
        </span>
      </footer>
    </GameDrawerShell>
  );
}

export function CardsDrawer({
  canTradeCards,
  cardState,
  cards,
  getCardTypeLabel,
  mustTradeCards,
  onClose,
  onToggleCard,
  onTradeCards,
  selectedCardIds,
  trading
}: CardsDrawerProps) {
  return (
    <GameDrawerShell
      title={t("game.actions.cards").toUpperCase()}
      eyebrow={t("game.cards.yourCardsCount", { count: cards.length, limit: 5 })}
      onClose={onClose}
      className="game-cards-modern-drawer"
    >
      <section className="game-card-trade-panel" id="card-trade-group">
        <div
          id="card-trade-alert"
          className="turn-alert turn-alert-danger"
          hidden={!mustTradeCards}
        >
          <strong>{t("game.tradeAlert.title")}</strong>
          <span>{t("game.cards.alert")}</span>
        </div>
        <div className="game-card-grid game-card-grid-compact" id="card-trade-list">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`game-card-tile game-card-tone-${cardTone(card)}${selectedCardIds.includes(card.id) ? " is-selected" : ""}`}
              data-card-id={card.id}
              onClick={() => onToggleCard(card.id)}
            >
              <span className="game-card-symbol">{cardSymbol(card)}</span>
              <strong>{card.territoryId || card.id}</strong>
              <small>{getCardTypeLabel(card)}</small>
              {selectedCardIds.includes(card.id) ? (
                <span className="game-card-check">{t("game.cards.selected")}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>
      <section className="game-card-exchange-box">
        <h3>{t("game.cards.exchangeCards")}</h3>
        <p>
          {mustTradeCards
            ? t("game.cards.mustTradeToContinue")
            : t("game.cards.tradeForReinforcements")}
        </p>
        <p id="card-trade-help">
          {t("game.runtime.tradeHelp.selected", { selected: selectedCardIds.length })}
        </p>
        <p>
          {t("game.cards.nextExchangeBonus")} <strong>+{cardState?.nextTradeBonus ?? 0}</strong>
        </p>
        <button
          id="card-trade-button"
          type="button"
          onClick={onTradeCards}
          disabled={!canTradeCards}
        >
          {trading ? t("game.commandDock.trading") : t("game.commandDock.tradeCards")}
        </button>
      </section>
    </GameDrawerShell>
  );
}

export function GameInfoDrawer({
  accessStatusLabel,
  enabledModules,
  gameId,
  gameStatusLabel,
  mapMetaLabel,
  meName,
  onClose,
  onSurrender,
  setupMetaLabel,
  showSurrender,
  surrenderDisabled,
  version
}: GameInfoDrawerProps) {
  return (
    <GameDrawerShell
      title={t("game.drawer.gameInfo").toUpperCase()}
      eyebrow={t("game.meta.activeGame")}
      onClose={onClose}
    >
      <div className="game-info-modern-list">
        <div>
          <span>{t("game.meta.activeGame")}</span>
          <strong>{gameStatusLabel}</strong>
          <small>Game ID: {gameId || t("game.meta.noActiveGame")}</small>
        </div>
        <div>
          <span>{t("game.meta.map")}</span>
          <strong>{mapMetaLabel}</strong>
        </div>
        <div>
          <span>{t("game.meta.player")}</span>
          <strong>{meName}</strong>
        </div>
        <div>
          <span>{t("game.meta.setup")}</span>
          <strong id="game-setup-meta">{setupMetaLabel}</strong>
        </div>
        <div>
          <span>{t("game.meta.access")}</span>
          <strong id="auth-status">{accessStatusLabel}</strong>
        </div>
        <div>
          <span>{t("game.meta.saveVersion")}</span>
          <strong>{typeof version === "number" ? `v${version}` : t("game.meta.live")}</strong>
          <small>{t("game.meta.autoSaveOn")}</small>
        </div>
      </div>
      <div className="game-enabled-modules">
        <h3>{t("game.meta.enabledModules")}</h3>
        {enabledModules.map((moduleLabel) => (
          <span key={moduleLabel}>{moduleLabel}</span>
        ))}
      </div>
      <button
        id="surrender-button"
        type="button"
        className="danger-button full-width game-drawer-danger"
        hidden={!showSurrender}
        onClick={onSurrender}
        disabled={surrenderDisabled}
      >
        {t("game.surrender")}
      </button>
    </GameDrawerShell>
  );
}

export function ActivityLogDrawer({
  entries,
  filter,
  isCleared,
  onClear,
  onClose,
  onFilterChange
}: ActivityLogDrawerProps) {
  const visibleEntries = isCleared
    ? []
    : entries.filter((entry) => filter === "all" || entry.category === filter);

  return (
    <GameDrawerShell
      title={t("game.drawer.activityLog").toUpperCase()}
      onClose={onClose}
      side="right"
    >
      <div className="game-log-tabs" role="tablist" aria-label={t("game.activityFilter.aria")}>
        {(["all", "combat", "cards", "turn"] as const).map((entryFilter) => (
          <button
            key={entryFilter}
            type="button"
            role="tab"
            aria-selected={filter === entryFilter}
            tabIndex={filter === entryFilter ? 0 : -1}
            className={filter === entryFilter ? "is-active" : ""}
            onClick={() => onFilterChange(entryFilter)}
          >
            {categoryLabel(entryFilter)}
          </button>
        ))}
      </div>
      <div className="log-list rail-log game-activity-list" id="log">
        {visibleEntries.length ? (
          visibleEntries.map((entry, index) => (
            <article className="game-log-entry" key={`${index}-${entry.text}`}>
              <span className={`game-log-icon game-log-icon-${entry.category}`} aria-hidden="true">
                <WarTableIcon name={categoryIcon(entry.category)} />
              </span>
              <span>
                <strong>{categoryLabel(entry.category)}</strong>
                <small>{entry.text}</small>
              </span>
              {entry.time ? <time>{entry.time}</time> : null}
            </article>
          ))
        ) : (
          <p className="action-help">{t("game.log.lobbyCreated")}</p>
        )}
      </div>
      <button type="button" className="game-log-clear-button" onClick={onClear}>
        {t("game.activityFilter.clearLog")}
      </button>
    </GameDrawerShell>
  );
}

export function ActivityLogTrigger({ isOpen, onClick }: { isOpen: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      className={`game-activity-trigger${isOpen ? " is-active" : ""}`}
      aria-pressed={isOpen}
      onClick={onClick}
    >
      <WarTableIcon name="clock" />
      <span>{t("game.drawer.activityLog")}</span>
    </button>
  );
}

export function GameActionDock({
  children,
  className = "",
  commandTitle,
  expanded,
  mode,
  onToggleExpanded
}: GameActionDockProps) {
  return (
    <aside
      className={`right-rail panel game-actions-rail game-command-dock campaign-shell game-command-dock-${mode} ${expanded ? "is-expanded" : "is-collapsed"} ${className}`.trim()}
      data-testid="actions-panel"
      data-command-dock-expanded={expanded ? "true" : "false"}
      data-command-mode={mode}
    >
      <button
        type="button"
        className="game-command-dock-toggle"
        aria-expanded={expanded}
        aria-label={expanded ? t("game.commandDock.collapse") : t("game.commandDock.expand")}
        onClick={onToggleExpanded}
      >
        <span aria-hidden="true">{expanded ? "v" : "^"}</span>
      </button>
      <div className="game-command-dock-title">
        <span>{commandTitle}</span>
      </div>
      {children}
    </aside>
  );
}
