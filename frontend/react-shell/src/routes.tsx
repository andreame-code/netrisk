import { startTransition, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useSearchParams
} from "react-router-dom";

import { LegacyAppShell } from "@react-shell/legacy-app-shell";
import { useAuth, AuthProvider } from "@react-shell/auth";
import { GameRoute } from "@react-shell/gameplay-route";
import { LandingRoute } from "@react-shell/landing-route";
import { LobbyCreateRoute } from "@react-shell/lobby-create-route";
import { LobbyRoute } from "@react-shell/lobby-route";
import { ProfileRoute } from "@react-shell/profile-route";
import {
  buildBootstrapPath,
  buildGameIndexPath,
  buildGamePath,
  buildLobbyPath,
  buildLoginPath,
  buildRegisterHref,
  normalizeNextPath,
  useShellNamespace
} from "@react-shell/public-auth-paths";
import { RegisterRoute } from "@react-shell/register-route";
import { messageFromError } from "@frontend-core/errors.mts";
import { t } from "@frontend-i18n";

function LoadingPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="status-panel" data-testid="react-shell-loading">
      <p className="status-label">Loading</p>
      <h2>{title}</h2>
      <p className="status-copy">{copy}</p>
    </section>
  );
}

function ErrorPanel({
  title,
  message,
  onRetry
}: {
  title: string;
  message: string;
  onRetry(): Promise<void>;
}) {
  return (
    <section className="status-panel status-panel-error" data-testid="react-shell-error">
      <p className="status-label">Error</p>
      <h2>{title}</h2>
      <p className="status-copy">{message}</p>
      <button type="button" className="refresh-button" onClick={() => void onRetry()}>
        Retry
      </button>
    </section>
  );
}

function ShellLayout() {
  return (
    <LegacyAppShell>
      <Outlet />
    </LegacyAppShell>
  );
}

function BootstrapRoute() {
  const { state, refresh } = useAuth();
  const namespace = useShellNamespace();

  if (state.status === "loading") {
    return (
      <LoadingPanel
        title="Bootstrapping the React shell"
        copy="Checking whether the current browser session can access protected routes."
      />
    );
  }

  if (state.status === "error") {
    return (
      <ErrorPanel title="React shell bootstrap failed" message={state.message} onRetry={refresh} />
    );
  }

  return (
    <Navigate to={state.status === "authenticated" ? buildLobbyPath(namespace) : "/"} replace />
  );
}

function GameHtmlBridge() {
  const [searchParams] = useSearchParams();
  const namespace = useShellNamespace();
  const rawGameId = searchParams.get("gameId");
  const gameId = typeof rawGameId === "string" ? rawGameId.trim() : "";

  return (
    <Navigate
      to={gameId ? buildGamePath(gameId, namespace) : buildGameIndexPath(namespace)}
      replace
    />
  );
}

function LoginPage() {
  const { state, signIn, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const namespace = useShellNamespace();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = normalizeNextPath(searchParams.get("next"), buildLobbyPath(namespace));

  if (state.status === "loading") {
    return (
      <LoadingPanel
        title="Preparing the login route"
        copy="Resolving any active browser session before the sign-in form is shown."
      />
      );
  }

  if (state.status === "error") {
    return (
      <ErrorPanel
        title="Unable to load the login route"
        message={state.message}
        onRetry={refresh}
      />
    );
  }

  if (state.status === "authenticated") {
    return <Navigate to={nextPath} replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await signIn({
        username: username.trim(),
        password
      });
      startTransition(() => {
        void navigate(nextPath, { replace: true });
      });
    } catch (error) {
      setErrorMessage(messageFromError(error, "Unable to sign in with those credentials."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section data-testid="react-shell-login-page">
      <p className="status-label">Accesso</p>
      <h2>Accedi al comando</h2>
      <p className="status-copy">
        Usa le stesse credenziali della UI legacy e torna subito sul percorso richiesto.
      </p>

      <form className="shell-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="shell-field">
          <span>Username</span>
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="shell-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {errorMessage ? (
          <p className="auth-feedback is-error" data-testid="react-shell-login-error">
            {errorMessage}
          </p>
        ) : null}

        <div className="shell-actions">
          <button type="submit" className="refresh-button" disabled={isSubmitting}>
            {isSubmitting ? "Accesso in corso..." : t("auth.login")}
          </button>
          <Link className="ghost-action" to={buildRegisterHref(nextPath, namespace)}>
            {t("auth.register")}
          </Link>
        </div>
      </form>
    </section>
  );
}

function UnauthorizedPage() {
  const namespace = useShellNamespace();

  return (
    <section data-testid="react-shell-unauthorized">
      <p className="status-label">Unauthorized</p>
      <h2>This route is reserved for authenticated access.</h2>
      <p className="status-copy">
        The shell includes a dedicated unauthorized route so future permission rules can fail in a
        predictable place.
      </p>
      <div className="shell-actions">
        <Link className="refresh-button" to={buildLoginPath(namespace)}>
          Go to login
        </Link>
        <Link className="ghost-action" to={buildLobbyPath(namespace)}>
          Try the lobby route
        </Link>
      </div>
    </section>
  );
}

function NotFoundPage() {
  const namespace = useShellNamespace();

  return (
    <section data-testid="react-shell-not-found">
      <p className="status-label">Not found</p>
      <h2>React shell route not found</h2>
      <p className="status-copy">
        Unknown React shell URLs now stay inside the React app instead of collapsing into a static
        404.
      </p>
      <div className="shell-actions">
        <Link className="refresh-button" to={buildBootstrapPath(namespace)}>
          Torna all&apos;inizio
        </Link>
        <Link className="ghost-action" to={buildLoginPath(namespace)}>
          {t("auth.login")}
        </Link>
      </div>
    </section>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/index.html" element={<LandingRoute />} />
          <Route path="/react" element={<BootstrapRoute />} />
          <Route element={<ShellLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/react/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterRoute />} />
            <Route path="/register.html" element={<RegisterRoute />} />
            <Route path="/react/register" element={<RegisterRoute />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/react/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/lobby.html" element={<LobbyRoute />} />
            <Route path="/react/lobby" element={<LobbyRoute />} />
            <Route path="/new-game.html" element={<LobbyCreateRoute />} />
            <Route path="/react/lobby/new" element={<LobbyCreateRoute />} />
            <Route path="/profile.html" element={<ProfileRoute />} />
            <Route path="/react/profile" element={<ProfileRoute />} />
            <Route path="/game.html" element={<GameHtmlBridge />} />
            <Route path="/game" element={<GameRoute />} />
            <Route path="/game/:gameId" element={<GameRoute />} />
            <Route path="/react/game" element={<GameRoute />} />
            <Route path="/react/game/:gameId" element={<GameRoute />} />
          </Route>
          <Route path="/react/*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
