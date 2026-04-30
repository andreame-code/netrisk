import { startTransition, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { register } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { validateRegistrationInput } from "@frontend-core/register-validation.mts";
import { t } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { LoadingAnimation } from "@react-shell/loading-animation";
import {
  buildLoginHref,
  buildProfilePath,
  normalizeNextPath,
  useShellNamespace
} from "@react-shell/public-auth-paths";

function requestMessages() {
  return {
    errorMessage: t("register.errors.submitFailed"),
    fallbackMessage: t("register.errors.submitFailed")
  };
}

export function RegisterRoute() {
  const { state, refresh, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const namespace = useShellNamespace();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = normalizeNextPath(searchParams.get("next"), buildProfilePath(namespace));

  if (state.status === "loading") {
    return (
      <section className="status-panel status-panel-loading" data-testid="react-shell-loading">
        <LoadingAnimation />
        <p className="status-label">Loading</p>
        <h2>Preparing the registration route</h2>
        <p className="status-copy">
          Resolving any active browser session before the registration form is shown.
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="status-panel status-panel-error" data-testid="react-shell-error">
        <p className="status-label">Error</p>
        <h2>Unable to load the registration route</h2>
        <p className="status-copy">{state.message}</p>
        <button type="button" className="refresh-button" onClick={() => void refresh()}>
          Retry
        </button>
      </section>
    );
  }

  if (state.status === "authenticated") {
    return <Navigate to={nextPath} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage("");

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const validationKey = validateRegistrationInput({
      username: trimmedUsername,
      email: trimmedEmail,
      password,
      confirmPassword
    });
    if (validationKey) {
      setErrorMessage(t(validationKey));
      return;
    }

    setIsSubmitting(true);

    try {
      await register(
        {
          username: trimmedUsername,
          password,
          ...(trimmedEmail ? { email: trimmedEmail } : {})
        },
        requestMessages()
      );

      await signIn({
        username: trimmedUsername,
        password
      });

      startTransition(() => {
        void navigate(nextPath, { replace: true });
      });
    } catch (error) {
      setErrorMessage(messageFromError(error, t("register.errors.submitFailed")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section data-testid="react-shell-register-page">
      <p className="status-label">Public route</p>
      <h2>{t("register.heading")}</h2>
      <p className="status-copy">{t("register.copy")}</p>

      <form className="shell-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="shell-field">
          <span>{t("register.username.label")}</span>
          <input
            name="username"
            autoComplete="username"
            maxLength={32}
            placeholder={t("register.username.placeholder")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="shell-field">
          <span>{t("register.email.label")}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={128}
            placeholder={t("register.email.placeholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="shell-field">
          <span>{t("register.password.label")}</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder={t("register.password.placeholder")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="shell-field">
          <span>{t("register.passwordConfirm.label")}</span>
          <input
            type="password"
            name="password-confirm"
            autoComplete="new-password"
            placeholder={t("register.passwordConfirm.placeholder")}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>

        <div className="placeholder-card">
          <span>{t("register.guideline.username")}</span>
          <span>{t("register.guideline.email")}</span>
          <span>{t("register.guideline.password")}</span>
        </div>

        {errorMessage ? (
          <p className="auth-feedback is-error" data-testid="react-shell-register-error">
            {errorMessage}
          </p>
        ) : null}

        <div className="shell-actions">
          <button type="submit" className="refresh-button" disabled={isSubmitting}>
            {t("register.submit")}
          </button>
          <Link className="ghost-action" to={buildLoginHref(nextPath, namespace)}>
            {t("auth.login")}
          </Link>
        </div>
      </form>
    </section>
  );
}
