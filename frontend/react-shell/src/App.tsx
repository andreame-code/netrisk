import { startTransition, useEffect, useState } from "react";

import { getSession, listGames } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";

type SessionResponse = Awaited<ReturnType<typeof getSession>>;
type GamesResponse = Awaited<ReturnType<typeof listGames>>;

type ApiSlice<T> =
  | {
      status: "success";
      data: T;
    }
  | {
      status: "error";
      message: string;
    };

type AppState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      session: ApiSlice<SessionResponse>;
      games: ApiSlice<GamesResponse>;
      loadedAt: string;
    }
  | {
      status: "error";
      message: string;
    };

const initialState: AppState = {
  status: "loading"
};

function requestMessages(scope: string) {
  return {
    errorMessage: `Unable to load ${scope}.`,
    fallbackMessage: `Unable to validate ${scope}.`
  };
}

function toSlice<T>(result: PromiseSettledResult<T>, fallbackMessage: string): ApiSlice<T> {
  if (result.status === "fulfilled") {
    return {
      status: "success",
      data: result.value
    };
  }

  return {
    status: "error",
    message: messageFromError(result.reason, fallbackMessage)
  };
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function load(): Promise<void> {
      const [sessionResult, gamesResult] = await Promise.allSettled([
        getSession(requestMessages("session")),
        listGames(requestMessages("game list"))
      ]);

      if (!isActive) {
        return;
      }

      const session = toSlice(sessionResult, "Session data unavailable.");
      const games = toSlice(gamesResult, "Game list unavailable.");
      const bothFailed = session.status === "error" && games.status === "error";

      startTransition(() => {
        if (bothFailed) {
          setState({
            status: "error",
            message: `${session.message} ${games.message}`.trim()
          });
          return;
        }

        setState({
          status: "ready",
          session,
          games,
          loadedAt: new Date().toISOString()
        });
      });
    }

    startTransition(() => {
      setState(initialState);
    });
    void load();

    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  const handleReload = () => {
    startTransition(() => {
      setReloadKey((current) => current + 1);
    });
  };

  return (
    <main className="react-shell-page">
      <section className="hero-panel">
        <p className="eyebrow">NetRisk</p>
        <h1>Parallel React shell</h1>
        <p className="hero-copy">
          A minimal React + Vite entry point that reuses the typed frontend API boundary without
          replacing the legacy interface.
        </p>
        <div className="hero-actions">
          <span className="chip">Route: /react/</span>
          <span className="chip">Typed API client reused</span>
          <button type="button" className="refresh-button" onClick={handleReload}>
            Reload smoke data
          </button>
        </div>
      </section>

      {state.status === "loading" ? (
        <section className="status-panel" data-testid="react-shell-loading">
          <p className="status-label">Loading</p>
          <h2>Bootstrapping the parallel shell</h2>
          <p className="status-copy">
            Fetching session and game summaries through the shared typed API client.
          </p>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="status-panel status-panel-error" data-testid="react-shell-error">
          <p className="status-label">Error</p>
          <h2>React shell smoke page could not load</h2>
          <p className="status-copy">{state.message}</p>
          <button type="button" className="refresh-button" onClick={handleReload}>
            Retry
          </button>
        </section>
      ) : null}

      {state.status === "ready" ? (
        <section className="grid-shell" data-testid="react-shell-ready">
          <article className="card-panel" data-testid="react-shell-session-panel">
            <div className="card-header">
              <p className="status-label">Session</p>
              <span
                className={
                  state.session.status === "success" ? "status-pill success" : "status-pill muted"
                }
                data-testid="react-shell-session-status"
              >
                {state.session.status === "success" ? "Authenticated" : "Guest fallback"}
              </span>
            </div>
            {state.session.status === "success" ? (
              <>
                <h2>{state.session.data.user.username}</h2>
                <p className="metric-copy">User id: {state.session.data.user.id}</p>
              </>
            ) : (
              <>
                <h2>No active session</h2>
                <p className="metric-copy">{state.session.message}</p>
              </>
            )}
          </article>

          <article className="card-panel" data-testid="react-shell-games-panel">
            <div className="card-header">
              <p className="status-label">Games</p>
              <span
                className={
                  state.games.status === "success" ? "status-pill success" : "status-pill muted"
                }
                data-testid="react-shell-games-status"
              >
                {state.games.status === "success" ? "Loaded" : "Fallback"}
              </span>
            </div>
            {state.games.status === "success" ? (
              <>
                <h2 data-testid="react-shell-games-count">{state.games.data.games.length} games</h2>
                <p className="metric-copy">
                  Active game: {state.games.data.activeGameId || "none selected"}
                </p>
                <ul className="game-list">
                  {state.games.data.games.slice(0, 4).map((game) => (
                    <li key={game.id} className="game-list-item">
                      <div>
                        <strong>{game.name}</strong>
                        <span>{game.mapName || game.mapId || "Map pending"}</span>
                      </div>
                      <div>
                        <strong>{game.phase}</strong>
                        <span>{game.playerCount} players</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2>Game list unavailable</h2>
                <p className="metric-copy">{state.games.message}</p>
              </>
            )}
          </article>

          <article className="card-panel card-panel-wide">
            <div className="card-header">
              <p className="status-label">Notes</p>
              <span className="status-pill">Smoke page</span>
            </div>
            <h2>Why this page exists</h2>
            <p className="metric-copy">
              This shell is intentionally narrow: it proves route wiring, Vite output, API reuse,
              and non-invasive coexistence with the current UI.
            </p>
            <p className="footer-note">Last refresh: {formatTimestamp(state.loadedAt)}</p>
          </article>
        </section>
      ) : null}
    </main>
  );
}
