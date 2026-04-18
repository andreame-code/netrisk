import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getProfile, updateThemePreference } from "@frontend-core/api/client.mts";
import { normalizeTheme } from "@frontend-core/contracts.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate, t } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { updateAuthenticatedUser } from "@react-shell/auth-store";
import { buildReactGamePath } from "@react-shell/legacy-game-handoff";
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

  if (!authenticatedUser) {
    return null;
  }

  const currentUser = authenticatedUser;

  async function handleProfileRetry(): Promise<void> {
    await refresh();
    await profileQuery.refetch();
  }

  async function handleThemeChange(nextTheme: string): Promise<void> {
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
  const activeGamesLabel = t(
    activeGames.length === 1 ? "profile.games.activeCount.one" : "profile.games.activeCount.other",
    { count: activeGames.length }
  );

  return (
    <section data-testid="react-shell-profile-page">
      <p className="status-label">{t("profile.eyebrow")}</p>
      <h2>{currentUser.username}</h2>
      <p className="status-copy">{t("profile.subtitle")}</p>

      <div className="profile-pilot-grid">
        <section className="placeholder-card profile-pilot-card">
          <div className="card-header profile-pilot-card-header">
            <div>
              <p className="status-label">{t("profile.preferences.eyebrow")}</p>
              <h3>{t("profile.preferences.heading")}</h3>
            </div>
            <span className="status-pill">{themeLabel(selectedTheme)}</span>
          </div>

          <p className="metric-copy">{t("profile.preferences.copy")}</p>

          <label className="shell-field">
            <span>{t("profile.preferences.label")}</span>
            <select
              value={selectedTheme}
              disabled={themeMutation.isPending}
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
            className={`profile-theme-status${themeFeedbackMode === "error" ? " is-error" : ""}`}
            data-testid="react-shell-profile-theme-status"
          >
            {themeStatusMessage}
          </p>
        </section>

        <section className="placeholder-card profile-pilot-card profile-pilot-card-wide">
          <div className="card-header profile-pilot-card-header">
            <div>
              <p className="status-label">{t("profile.heading")}</p>
              <h3>{profile?.playerName || currentUser.username}</h3>
            </div>
            <span className="status-pill">{activeGamesLabel}</span>
          </div>

          {profileQuery.isLoading ? (
            <div className="profile-query-state" data-testid="react-shell-profile-loading">
              <p className="metric-copy">{t("profile.feedback")}</p>
            </div>
          ) : profileQuery.isError ? (
            <div
              className="profile-query-state profile-query-state-error"
              data-testid="react-shell-profile-error"
            >
              <p className="metric-copy">
                {messageFromError(profileQuery.error, t("profile.errors.loadFailed"))}
              </p>
              <div className="shell-actions">
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleProfileRetry()}
                >
                  Retry profile
                </button>
              </div>
            </div>
          ) : profile ? (
            <>
              <div className="profile-metric-grid" data-testid="react-shell-profile-metrics">
                <article className="profile-metric-card">
                  <span>{t("profile.metrics.gamesPlayed")}</span>
                  <strong>{profile.gamesPlayed}</strong>
                </article>
                <article className="profile-metric-card">
                  <span>{t("profile.metrics.wins")}</span>
                  <strong>{profile.wins}</strong>
                </article>
                <article className="profile-metric-card">
                  <span>{t("profile.metrics.losses")}</span>
                  <strong>{profile.losses}</strong>
                </article>
                <article className="profile-metric-card">
                  <span>{t("profile.metrics.inProgress")}</span>
                  <strong>{profile.gamesInProgress}</strong>
                </article>
                <article className="profile-metric-card">
                  <span>{t("profile.metrics.winRate")}</span>
                  <strong>{profile.winRate == null ? "--" : `${profile.winRate}%`}</strong>
                </article>
              </div>

              {!profile.hasHistory ? (
                <div className="profile-query-state" data-testid="react-shell-profile-empty">
                  <p className="metric-copy">{t("profile.runtime.noStats")}</p>
                </div>
              ) : null}

              <div className="profile-active-games">
                <div className="card-header profile-pilot-card-header">
                  <div>
                    <p className="status-label">{t("profile.games.kicker")}</p>
                    <h3>{activeGamesLabel}</h3>
                  </div>
                  {profileQuery.isFetching ? (
                    <span className="status-pill muted">Syncing</span>
                  ) : null}
                </div>

                {!activeGames.length ? (
                  <p className="metric-copy">{t("profile.runtime.directiveNote.none")}</p>
                ) : (
                  <div className="profile-active-games-list">
                    {activeGames.map((game) => (
                      <article className="profile-active-game-card" key={game.id}>
                        <div className="profile-active-game-copy">
                          <strong>{game.name}</strong>
                          <span>
                            {game.mapName || game.mapId || t("common.notAvailable")} ·{" "}
                            {phaseLabel(game.phase)}
                          </span>
                          <span>
                            {t("profile.games.updatedAt", {
                              updatedAt: formatUpdatedAt(game.updatedAt)
                            })}
                          </span>
                        </div>

                        <a
                          className="ghost-action"
                          href={buildReactGamePath(game.id)}
                          data-testid={`react-shell-profile-open-${game.id}`}
                        >
                          {t("profile.runtime.directive.resume")}
                        </a>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
