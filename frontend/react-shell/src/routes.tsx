import { startTransition, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";

import { useAuth, AuthProvider } from "@react-shell/auth";
import { LobbyCreateRoute } from "@react-shell/lobby-create-route";
import { LobbyRoute } from "@react-shell/lobby-route";
import { ProfileRoute } from "@react-shell/profile-route";
import { messageFromError } from "@frontend-core/errors.mts";

function normalizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/lobby";
  }

  if (nextPath === "/login" || nextPath.startsWith("/login?") || nextPath === "/unauthorized") {
    return "/lobby";
  }

  return nextPath;
}

function buildLoginHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

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
  const { state, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutPending, setLogoutPending] = useState(false);
  const nextPath = normalizeNextPath(location.pathname + location.search);

  async function handleLogout(): Promise<void> {
    setLogoutPending(true);

    try {
      await signOut();
      startTransition(() => {
        void navigate("/login", { replace: true });
      });
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <div className="react-shell-page shell-layout" data-testid="react-shell-layout">
      <header className="hero-panel shell-header">
        <div className="shell-brand">
          <p className="eyebrow">NetRisk</p>
          <h1>Session-aware React shell</h1>
          <p className="hero-copy">
            Client routing, route guards, and session bootstrap are now centralized under the
            parallel React app without replacing the existing legacy flows yet.
          </p>
        </div>

        <div className="shell-session-box">
          <div className="card-header shell-session-header">
            <p className="status-label">Session</p>
            <span
              className={
                state.status === "authenticated"
                  ? "status-pill success"
                  : state.status === "error"
                    ? "status-pill danger"
                    : "status-pill muted"
              }
              data-testid="react-shell-session-status"
            >
              {state.status === "authenticated"
                ? "Authenticated"
                : state.status === "loading"
                  ? "Checking"
                  : state.status === "error"
                    ? "Error"
                    : "Guest"}
            </span>
          </div>

          {state.status === "authenticated" ? (
            <div className="shell-session-copy">
              <strong>{state.user.username}</strong>
              <span>User id: {state.user.id}</span>
            </div>
          ) : (
            <p className="metric-copy shell-session-copy">
              {state.status === "loading"
                ? "Checking the existing browser session."
                : state.status === "error"
                  ? state.message
                  : state.message}
            </p>
          )}

          <div className="shell-actions">
            {state.status === "authenticated" ? (
              <button
                type="button"
                className="refresh-button"
                onClick={() => void handleLogout()}
                disabled={logoutPending}
              >
                {logoutPending ? "Signing out..." : "Sign out"}
              </button>
            ) : (
              <Link className="refresh-button" to={buildLoginHref(nextPath)}>
                Sign in
              </Link>
            )}
            <button
              type="button"
              className="ghost-action"
              onClick={() => void refresh()}
              disabled={state.status === "loading"}
            >
              Retry session
            </button>
          </div>
        </div>
      </header>

      <div className="grid-shell shell-grid">
        <aside className="card-panel shell-nav-panel">
          <div className="card-header">
            <p className="status-label">Navigation</p>
            <span className="status-pill">/react</span>
          </div>
          <nav
            className="main-nav-shell"
            aria-label="React shell sections"
            data-testid="react-shell-nav"
          >
            <NavItem to="/lobby" label="Lobby" />
            <NavItem to="/profile" label="Profile" />
            <NavItem to="/game" label="Game" />
          </nav>
          <p className="metric-copy">
            Protected destinations redirect to the React login route when the session is missing.
          </p>
        </aside>

        <main className="card-panel card-panel-wide shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link shell-nav-link${isActive ? " is-active" : ""}`}
    >
      {label}
    </NavLink>
  );
}

function BootstrapRoute() {
  const { state, refresh } = useAuth();

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

  return <Navigate to={state.status === "authenticated" ? "/lobby" : "/login"} replace />;
}

function ProtectedRoute() {
  const { state, refresh } = useAuth();
  const location = useLocation();

  if (state.status === "loading") {
    return (
      <LoadingPanel
        title="Checking route access"
        copy="Resolving the current browser session before the protected page is rendered."
      />
    );
  }

  if (state.status === "error") {
    return (
      <ErrorPanel title="Protected route unavailable" message={state.message} onRetry={refresh} />
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <Navigate
        to={buildLoginHref(normalizeNextPath(location.pathname + location.search))}
        replace
      />
    );
  }

  return <Outlet />;
}

function PlaceholderPage({
  eyebrow,
  title,
  copy,
  details
}: {
  eyebrow: string;
  title: string;
  copy: string;
  details: ReactNode;
}) {
  return (
    <section data-testid={`react-shell-${eyebrow.toLowerCase()}-page`}>
      <p className="status-label">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="status-copy">{copy}</p>
      <div className="placeholder-stack">{details}</div>
    </section>
  );
}

function GamePlaceholderPage() {
  const params = useParams();

  return (
    <PlaceholderPage
      eyebrow="Game"
      title="React gameplay shell placeholder"
      copy="This protected route reserves the shape for the future gameplay migration while keeping backend engine authority unchanged."
      details={
        <>
          <div className="placeholder-card">
            <strong>Game route</strong>
            <span>
              {params.gameId ? `Selected game id: ${params.gameId}` : "No game selected yet."}
            </span>
          </div>
          <div className="placeholder-card">
            <strong>Deep links supported</strong>
            <span>
              Refreshing a direct `/react/game/:gameId` URL now resolves through the SPA shell.
            </span>
          </div>
        </>
      }
    />
  );
}

function LoginPage() {
  const { state, signIn, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = normalizeNextPath(searchParams.get("next"));

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
      <p className="status-label">Public route</p>
      <h2>Sign in to the React shell</h2>
      <p className="status-copy">
        Protected React routes now redirect here instead of scattering session checks across pages.
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
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <Link className="ghost-action" to="/unauthorized">
            Unauthorized route
          </Link>
        </div>

        <p className="footer-note">After sign-in you will return to: {nextPath}</p>
      </form>
    </section>
  );
}

function UnauthorizedPage() {
  return (
    <section data-testid="react-shell-unauthorized">
      <p className="status-label">Unauthorized</p>
      <h2>This route is reserved for authenticated access.</h2>
      <p className="status-copy">
        The shell includes a dedicated unauthorized route so future permission rules can fail in a
        predictable place.
      </p>
      <div className="shell-actions">
        <Link className="refresh-button" to="/login">
          Go to login
        </Link>
        <Link className="ghost-action" to="/lobby">
          Try the lobby route
        </Link>
      </div>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section data-testid="react-shell-not-found">
      <p className="status-label">Not found</p>
      <h2>React shell route not found</h2>
      <p className="status-copy">
        Unknown React shell URLs now stay inside the React app instead of collapsing into a static
        404.
      </p>
      <div className="shell-actions">
        <Link className="refresh-button" to="/">
          Restart bootstrap
        </Link>
        <Link className="ghost-action" to="/login">
          Open login
        </Link>
      </div>
    </section>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter basename="/react">
      <AuthProvider>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route index element={<BootstrapRoute />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="unauthorized" element={<UnauthorizedPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="lobby">
                <Route index element={<LobbyRoute />} />
                <Route path="new" element={<LobbyCreateRoute />} />
              </Route>
              <Route path="profile" element={<ProfileRoute />} />
              <Route path="game">
                <Route index element={<GamePlaceholderPage />} />
                <Route path=":gameId" element={<GamePlaceholderPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
