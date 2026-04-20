import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getProfile, updateThemePreference } from "@frontend-core/api/client.mts";
import { normalizeTheme } from "@frontend-core/contracts.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate, t } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { updateAuthenticatedUser } from "@react-shell/auth-store";
import { buildReactGamePath } from "@react-shell/legacy-game-handoff";
import { ProfileAdminModules } from "@react-shell/profile-admin-modules";
import { buildLobbyPath, buildNewGamePath } from "@react-shell/public-auth-paths";
import { profileDetailQueryKey } from "@react-shell/react-query";
import { applyShellTheme, shellThemes, themeLabel } from "@react-shell/theme";

function phaseLabel(phase: string): string {
  if (phase === "active") {
    return t("common.phase.active");
  }

  if (phase === "finished") {
    return t("common.phase.finished");
  }

  return t("common.phase.lobby");
}

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) {
    return t("common.notAvailable");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return t("common.notAvailable");
  }

  return formatDate(parsed, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function profileRankTitle(winRate: number | null | undefined): string {
  if (winRate == null) {
    return t("profile.ranks.recruit");
  }

  if (winRate >= 70) {
    return t("profile.ranks.supremeStrategist");
  }

  if (winRate >= 55) {
    return t("profile.ranks.armyCommander");
  }

  if (winRate >= 40) {
    return t("profile.ranks.lineOfficer");
  }

  return t("profile.ranks.recruit");
}

export function ProfileRoute() {
  const { state, refresh } = useAuth();
  const queryClient = useQueryClient();
  const authenticatedUser = state.status === "authenticated" ? state.user : null;
  const committedTheme = normalizeTheme(authenticatedUser?.preferences?.theme || null);
  const [selectedTheme, setSelectedTheme] = useState(committedTheme);
  const [themeFeedbackMode, setThemeFeedbackMode] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [themeErrorMessage, setThemeErrorMessage] = useState("");

  useEffect(() => {
    setSelectedTheme(committedTheme);
    applyShellTheme(committedTheme);
  }, [committedTheme]);

  useEffect(() => {
    document.title = t("profile.title");
  }, []);

  const profileQuery = useQuery({
    queryKey: profileDetailQueryKey(String(authenticatedUser?.id ?? "anonymous")),
    enabled: Boolean(authenticatedUser),
    queryFn: () =>
      getProfile({
        errorMessage: t("profile.errors.unavailable"),
        fallbackMessage: t("profile.errors.loadFailed")
      })
  });

  const themeMutation = useMutation({
    mutationFn: (theme: string) =>
      updateThemePreference(theme, {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("profile.preferences.status.saveFailed", {
          theme: themeLabel(theme)
        })
      })
  });

  const currentUser = authenticatedUser;

  async function handleProfileRetry(): Promise<void> {
    await refresh();
    if (currentUser) {
      await profileQuery.refetch();
    }
  }

  async function handleThemeChange(nextTheme: string): Promise<void> {
    if (!currentUser) {
      return;
    }

    const previousTheme = committedTheme;

    setSelectedTheme(nextTheme);
    setThemeFeedbackMode("saving");
    setThemeErrorMessage("");

    try {
      const response = await themeMutation.mutateAsync(nextTheme);
      const syncedUser = {
        ...currentUser,
        ...response.user,
        preferences: response.preferences || response.user.preferences || currentUser.preferences
      };
      const storedTheme = normalizeTheme(
        response.preferences?.theme || response.user.preferences?.theme || nextTheme
      );

      updateAuthenticatedUser(syncedUser);
      applyShellTheme(storedTheme);
      setSelectedTheme(storedTheme);
      setThemeFeedbackMode("saved");
      await queryClient.invalidateQueries({ queryKey: profileDetailQueryKey(currentUser.id) });
    } catch (error) {
      applyShellTheme(previousTheme);
      setSelectedTheme(previousTheme);
      setThemeFeedbackMode("error");
      setThemeErrorMessage(
        messageFromError(
          error,
          t("profile.preferences.status.saveFailed", {
            theme: themeLabel(previousTheme)
          })
        )
      );
    }
  }

  const themeStatusMessage =
    themeFeedbackMode === "saving"
      ? t("profile.preferences.status.saving")
      : themeFeedbackMode === "saved"
        ? t("profile.preferences.status.saved", { theme: themeLabel(selectedTheme) })
        : themeFeedbackMode === "error"
          ? themeErrorMessage
          : t("profile.preferences.status.current", { theme: themeLabel(committedTheme) });

  const profile = profileQuery.data?.profile || null;
  const activeGames = Array.isArray(profile?.participatingGames) ? profile.participatingGames : [];
  const activeGame = activeGames[0] || null;
  const activeGamesLabel = t(
    activeGames.length === 1 ? "profile.games.activeCount.one" : "profile.games.activeCount.other",
    { count: activeGames.length }
  );
  const hasProfileHistory = Boolean(profile?.hasHistory);
  const profileContentVisible = Boolean(profile && hasProfileHistory && !profileQuery.isError);
  const signedOut = state.status === "unauthenticated" && state.message === "Signed out.";
  const authStatusMessage = currentUser
    ? t("profile.auth.loggedIn", { username: currentUser.username })
    : signedOut
      ? t("profile.auth.loggedOut")
      : state.status === "loading"
        ? t("profile.authStatus")
        : t("profile.auth.unavailable");
  const profileName = currentUser
    ? profile?.playerName || currentUser.username
    : t("profile.runtime.unavailableTitle");
  const profileSubtitle = currentUser
    ? profileQuery.isError
      ? t("profile.runtime.temporarilyUnavailable")
      : profile
        ? hasProfileHistory
          ? t("profile.runtime.subtitle.withHistory")
          : t("profile.runtime.subtitle.noHistory")
        : t("profile.subtitle")
    : t("profile.runtime.unavailableSubtitle");
  const feedbackMessage =
    state.status === "loading"
      ? t("profile.feedback")
      : !currentUser
        ? state.status === "error"
          ? state.message
          : signedOut
            ? t("profile.runtime.loggedOutFeedback")
            : t("profile.errors.loginRequired")
        : profileQuery.isLoading
          ? t("profile.feedback")
          : profileQuery.isError
            ? messageFromError(profileQuery.error, t("profile.errors.loadFailed"))
            : !profile
              ? t("profile.errors.loadFailed")
              : hasProfileHistory
                ? ""
                : t("profile.runtime.noStats");
  const showFeedback = Boolean(feedbackMessage);
  const feedbackIsError =
    state.status === "error" || signedOut || (!currentUser && state.status !== "loading") || profileQuery.isError;
  const commanderStatus = profile
    ? hasProfileHistory
      ? t("profile.runtime.commandStatus.withHistory", {
          gamesPlayed: profile.gamesPlayed
        })
      : t("profile.runtime.commandStatus.noHistory")
    : t("profile.commander.copy");
  const focusLabel = activeGame ? activeGame.name : t("profile.front.value");
  const focusNote = activeGame
    ? t("profile.runtime.commandFocusNote.active", {
        phase: phaseLabel(activeGame.phase),
        mapName: activeGame.mapName || activeGame.mapId || t("common.classicMini")
      })
    : t("profile.runtime.commandFocusNote.none");
  const directiveLabel = profile
    ? profile.gamesInProgress > 0
      ? t("profile.runtime.directive.resume")
      : t("profile.runtime.directive.plan")
    : t("profile.directive.value");
  const directiveNote = profile
    ? profile.gamesInProgress > 0
      ? t("profile.runtime.directiveNote.active", { count: profile.gamesInProgress })
      : t("profile.runtime.directiveNote.none")
    : t("profile.directive.copy");
  const knownMaps = activeGames
    .map((game) => game.mapName || game.mapId)
    .filter((value): value is string => Boolean(value));
  const momentum = (profile?.wins || 0) - (profile?.losses || 0);
  const rankingTitle = profileRankTitle(profile?.winRate);
  const rankingCopy = profile
    ? profile.gamesPlayed > 0
      ? t("profile.runtime.rankingCopy.withHistory", {
          wins: profile.wins,
          losses: profile.losses,
          winRate: profile.winRate == null ? "--" : `${profile.winRate}%`
        })
      : t("profile.runtime.rankingCopy.noHistory")
    : t("profile.ranking.copy");
  const mapTitle = knownMaps[0] || t("profile.map.title");
  const mapCopy = knownMaps.length
    ? t("profile.runtime.mapCopy.withHistory", { maps: knownMaps.join(", ") })
    : profile
      ? t("profile.runtime.mapCopy.noHistory")
      : t("profile.map.copy");
  const advancedTitle =
    profile && profile.gamesPlayed > 0
      ? t("profile.runtime.advancedTitle.withHistory", {
          momentum: `${momentum >= 0 ? "+" : ""}${momentum}`
        })
      : t("profile.advanced.title");
  const advancedCopy = profile
    ? profile.gamesPlayed > 0
      ? t("profile.runtime.advancedCopy.withHistory", {
          inProgress: profile.gamesInProgress,
          gamesPlayed: profile.gamesPlayed
        })
      : t("profile.runtime.advancedCopy.noHistory")
    : t("profile.advanced.copy");
  const profileCopy = profile
    ? hasProfileHistory
      ? t("profile.runtime.copy.withHistory")
      : t("profile.runtime.copy.noHistory")
    : t("profile.summary.copy");
  const profileFeedbackTestId =
    state.status === "loading" || (currentUser && profileQuery.isLoading)
      ? "react-shell-profile-loading"
      : feedbackIsError
        ? "react-shell-profile-error"
        : currentUser && profile && !hasProfileHistory
          ? "react-shell-profile-empty"
          : undefined;

  return (
    <section data-testid="react-shell-profile-page">
      <section className="profile-shell panel campaign-shell" data-testid="player-profile-shell">
        <div className="profile-hero campaign-hero">
          <div className="profile-hero-copy campaign-hero-copy">
            <p className="eyebrow profile-section-eyebrow">{t("profile.eyebrow")}</p>
            <h1 id="profile-heading">{currentUser ? profileName : t("profile.heading")}</h1>
            <p id="profile-subtitle" className="stage-copy">
              {profileSubtitle}
            </p>
          </div>
          <div className="page-header-actions compact-actions profile-hero-actions">
            <Link className="ghost-button profile-back-button" to={buildLobbyPath()}>
              {t("profile.backToLobby")}
            </Link>
            <Link className="ghost-button lobby-create-button" to={buildNewGamePath()}>
              {t("profile.createGame")}
            </Link>
          </div>
        </div>

        <div className="content-meta-line profile-meta-line campaign-status-line">
          <span id="profile-name">{profileName}</span>
          <span className="status-divider" aria-hidden="true" />
          <span id="auth-status">{authStatusMessage}</span>
        </div>

        <div
          id="profile-feedback"
          className={`profile-feedback${feedbackIsError ? " is-error" : ""}`}
          data-testid={profileFeedbackTestId}
          hidden={!showFeedback}
        >
          {feedbackMessage}
          {currentUser && profileQuery.isError ? (
            <div className="shell-actions">
              <button
                type="button"
                className="ghost-button profile-back-button"
                onClick={() => void handleProfileRetry()}
              >
                Retry profile
              </button>
            </div>
          ) : null}
        </div>

        <section
          id="profile-preferences"
          className="profile-preferences profile-note-card"
          hidden={!currentUser}
        >
          <div className="profile-preferences-head">
            <div>
              <p className="eyebrow profile-section-eyebrow">{t("profile.preferences.eyebrow")}</p>
              <h3>{t("profile.preferences.heading")}</h3>
            </div>
          </div>
          <p className="stage-copy">{t("profile.preferences.copy")}</p>
          <div className="profile-theme-row">
            <label className="profile-theme-field" htmlFor="profile-theme-select">
              <span className="profile-theme-label">{t("profile.preferences.label")}</span>
              <select
                id="profile-theme-select"
                className="top-nav-locale-select profile-theme-select"
                value={selectedTheme}
                disabled={themeMutation.isPending || !currentUser}
                onChange={(event) => void handleThemeChange(event.target.value)}
                data-testid="react-shell-profile-theme-select"
              >
                {shellThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {themeLabel(theme.id)}
                  </option>
                ))}
              </select>
            </label>
            <p
              id="profile-theme-status"
              className={`profile-theme-status${themeFeedbackMode === "error" ? " is-error" : ""}`}
              data-testid="react-shell-profile-theme-status"
            >
              {themeStatusMessage}
            </p>
          </div>
        </section>

        <div id="profile-modules" hidden={currentUser?.role !== "admin"}>
          {currentUser?.role === "admin" ? <ProfileAdminModules userId={currentUser.id} /> : null}
        </div>

        <section id="profile-content" className="profile-content" hidden={!profileContentVisible}>
          <div className="profile-summary-card campaign-summary-card">
            <p className="eyebrow profile-section-eyebrow">{t("profile.summary.eyebrow")}</p>
            <h3>{t("profile.summary.heading")}</h3>
            <p id="profile-copy" className="stage-copy">
              {profileCopy}
            </p>
          </div>

          <div className="profile-command-strip" aria-label={t("profile.overviewAria")}>
            <article className="profile-command-card profile-command-card-accent">
              <span className="profile-command-label">{t("profile.commander.label")}</span>
              <strong id="profile-command-name">
                {profile?.playerName || currentUser?.username || t("profile.commander.value")}
              </strong>
              <p id="profile-command-status">{commanderStatus}</p>
            </article>
            <article className="profile-command-card">
              <span className="profile-command-label">{t("profile.front.label")}</span>
              <strong id="profile-command-focus">{focusLabel}</strong>
              <p id="profile-command-focus-note">{focusNote}</p>
            </article>
            <article className="profile-command-card">
              <span className="profile-command-label">{t("profile.directive.label")}</span>
              <strong id="profile-command-directive">{directiveLabel}</strong>
              <p id="profile-command-directive-note">{directiveNote}</p>
            </article>
          </div>

          <div className="profile-metrics-grid" data-testid="react-shell-profile-metrics">
            <article className="profile-metric-card">
              <span className="profile-metric-label">{t("profile.metrics.gamesPlayed")}</span>
              <strong id="metric-games-played" className="profile-metric-value">
                {profile?.gamesPlayed || 0}
              </strong>
            </article>
            <article className="profile-metric-card accent-win">
              <span className="profile-metric-label">{t("profile.metrics.wins")}</span>
              <strong id="metric-wins" className="profile-metric-value">
                {profile?.wins || 0}
              </strong>
            </article>
            <article className="profile-metric-card accent-loss">
              <span className="profile-metric-label">{t("profile.metrics.losses")}</span>
              <strong id="metric-losses" className="profile-metric-value">
                {profile?.losses || 0}
              </strong>
            </article>
            <article className="profile-metric-card accent-neutral">
              <span className="profile-metric-label">{t("profile.metrics.inProgress")}</span>
              <strong id="metric-in-progress" className="profile-metric-value">
                {profile?.gamesInProgress || 0}
              </strong>
            </article>
            <article className="profile-metric-card accent-gold wide-card">
              <span className="profile-metric-label">{t("profile.metrics.winRate")}</span>
              <strong id="metric-win-rate" className="profile-metric-value">
                {profile?.winRate == null ? "--" : `${profile.winRate}%`}
              </strong>
            </article>
          </div>

          <div className="profile-future-grid">
            <article className="profile-note-card profile-games-card">
              <div className="profile-games-head">
                <div>
                  <p className="eyebrow profile-section-eyebrow">{t("profile.games.eyebrow")}</p>
                  <h3>{t("profile.games.heading")}</h3>
                </div>
                <span id="profile-games-count" className="badge">
                  {activeGamesLabel}
                </span>
              </div>
              <div id="profile-games-empty" className="profile-games-empty" hidden={activeGames.length > 0}>
                {t("profile.games.empty")}
              </div>
              <div id="profile-games-list" className="profile-games-list" hidden={!activeGames.length}>
                {activeGames.map((game) => (
                  <a
                    className="profile-game-row"
                    data-open-game-id={game.id}
                    data-testid={`react-shell-profile-open-${game.id}`}
                    href={buildReactGamePath(game.id)}
                    key={game.id}
                  >
                    <span className="profile-game-primary">
                      <span className="profile-game-kicker">{t("profile.games.kicker")}</span>
                      <span className="profile-game-name">{game.name}</span>
                      <span className="profile-game-sub">
                        {game.mapName || game.mapId || t("common.classicMini")}
                      </span>
                    </span>
                    <span className="profile-game-meta-row">
                      <span className="badge">{phaseLabel(game.phase)}</span>
                      <span className="profile-game-meta">
                        {t("profile.games.updatedAt", {
                          updatedAt: formatUpdatedAt(game.updatedAt)
                        })}
                      </span>
                    </span>
                    <span className="ghost-button">{t("profile.runtime.directive.resume")}</span>
                  </a>
                ))}
              </div>
            </article>
            <article className="profile-note-card">
              <h3>{t("profile.space.heading")}</h3>
              <p>{t("profile.space.copy")}</p>
            </article>
          </div>

          <div className="profile-intel-grid">
            <article className="profile-note-card profile-intel-card">
              <p className="eyebrow profile-section-eyebrow">{t("profile.ranking.eyebrow")}</p>
              <h3 id="profile-ranking-title">{rankingTitle}</h3>
              <p id="profile-ranking-copy">{rankingCopy}</p>
            </article>
            <article className="profile-note-card profile-intel-card">
              <p className="eyebrow profile-section-eyebrow">{t("profile.map.eyebrow")}</p>
              <h3 id="profile-map-title">{mapTitle}</h3>
              <p id="profile-map-copy">{mapCopy}</p>
            </article>
            <article className="profile-note-card profile-intel-card">
              <p className="eyebrow profile-section-eyebrow">{t("profile.advanced.eyebrow")}</p>
              <h3 id="profile-advanced-title">{advancedTitle}</h3>
              <p id="profile-advanced-copy">{advancedCopy}</p>
            </article>
          </div>
        </section>
      </section>
    </section>
  );
}
