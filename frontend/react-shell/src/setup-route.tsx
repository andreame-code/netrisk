import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { completeSetup, createSetupAdmin, getSetupStatus } from "@frontend-core/api/client.mjs";
import type { SetupStatusResponse } from "@frontend-generated/shared-runtime-validation.mjs";
import { messageFromError } from "@frontend-core/errors.mts";
import { buildLoginPath, useShellNamespace } from "@react-shell/public-auth-paths";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; setup: SetupStatusResponse };

const setupMessages = {
  errorMessage: "Unable to load setup status.",
  fallbackMessage: "Unable to reach the setup API."
};

function SetupStep({
  state,
  title,
  copy
}: {
  state: "done" | "ready" | "blocked";
  title: string;
  copy: string;
}) {
  return (
    <li className={`setup-step setup-step-${state}`}>
      <span className="status-pill">
        {state === "done" ? "Done" : state === "ready" ? "Ready" : "Blocked"}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
    </li>
  );
}

export function SetupRoute() {
  const namespace = useShellNamespace();
  const loginPath = buildLoginPath(namespace);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"error" | "success">("success");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refresh(): Promise<void> {
    setLoadState({ status: "loading" });
    try {
      const setup = await getSetupStatus(setupMessages);
      setLoadState({ status: "ready", setup });
    } catch (error) {
      setLoadState({
        status: "error",
        message: messageFromError(error, "Unable to load setup status.")
      });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFeedback("");
    setFeedbackKind("success");
    setIsSubmitting(true);

    try {
      const result = await createSetupAdmin(
        {
          username: username.trim(),
          password
        },
        {
          errorMessage: "Unable to create the first admin user.",
          fallbackMessage: "Unable to create the first admin user."
        }
      );
      setPassword("");
      setFeedbackKind("success");
      setFeedback(`Admin user "${result.user.username}" created.`);
      setLoadState({ status: "ready", setup: result.status });
    } catch (error) {
      setFeedbackKind("error");
      setFeedback(messageFromError(error, "Unable to create the first admin user."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteSetup(): Promise<void> {
    setFeedback("");
    setFeedbackKind("success");
    setIsSubmitting(true);

    try {
      const result = await completeSetup({
        errorMessage: "Unable to complete setup.",
        fallbackMessage: "Unable to complete setup."
      });
      setFeedback("Setup completed. Continue to login.");
      setLoadState({ status: "ready", setup: result.status });
    } catch (error) {
      setFeedbackKind("error");
      setFeedback(messageFromError(error, "Unable to complete setup."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadState.status === "loading") {
    return (
      <section
        className="status-panel status-panel-loading"
        data-testid="react-shell-setup-loading"
      >
        <p className="status-label">First run setup</p>
        <h2>Checking local setup</h2>
        <p className="status-copy">Verifying the app and datastore before setup continues.</p>
      </section>
    );
  }

  if (loadState.status === "error") {
    return (
      <section className="status-panel status-panel-error" data-testid="react-shell-setup-error">
        <p className="status-label">First run setup</p>
        <h2>Setup status unavailable</h2>
        <p className="status-copy">{loadState.message}</p>
        <button type="button" className="refresh-button" onClick={() => void refresh()}>
          Retry
        </button>
      </section>
    );
  }

  const setup = loadState.setup;
  const canCreateAdmin = setup.setupRequired && setup.datastoreOk && !setup.hasAdminUser;
  const canCompleteSetup = setup.setupRequired && setup.datastoreOk && setup.hasAdminUser;
  const isComplete = !setup.setupRequired && setup.setupCompleted && setup.hasAdminUser;

  return (
    <section className="setup-route" data-testid="react-shell-setup-page">
      <p className="status-label">First run setup</p>
      <h2>{isComplete ? "Setup already completed" : "Prepare this NetRisk installation"}</h2>
      <p className="status-copy">
        {isComplete
          ? "This installation is locked and ready for normal sign-in."
          : "Confirm local startup, create the first admin, then lock the setup flow."}
      </p>

      <ol className="setup-steps">
        <SetupStep
          state="done"
          title="Application startup"
          copy="The setup page loaded from the running app."
        />
        <SetupStep
          state={setup.datastoreOk ? "done" : "blocked"}
          title="Datastore"
          copy={
            setup.datastoreOk ? "Datastore health check passed." : "Datastore health check failed."
          }
        />
        <SetupStep
          state={setup.hasAdminUser ? "done" : canCreateAdmin ? "ready" : "blocked"}
          title="Admin user"
          copy={
            setup.hasAdminUser ? "At least one admin user exists." : "Create the first admin user."
          }
        />
        <SetupStep
          state={setup.setupCompleted ? "done" : canCompleteSetup ? "ready" : "blocked"}
          title="Setup lock"
          copy={
            setup.setupCompleted
              ? "Setup is marked completed."
              : "Complete setup after the admin exists."
          }
        />
      </ol>

      {canCreateAdmin ? (
        <form className="shell-form setup-form" onSubmit={(event) => void handleCreateAdmin(event)}>
          <label className="shell-field">
            <span>Admin username</span>
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label className="shell-field">
            <span>Admin password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          <div className="shell-actions">
            <button type="submit" className="refresh-button" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create admin"}
            </button>
          </div>
        </form>
      ) : null}

      {canCompleteSetup ? (
        <div className="setup-complete-panel">
          <button
            type="button"
            className="refresh-button"
            disabled={isSubmitting}
            onClick={() => void handleCompleteSetup()}
          >
            {isSubmitting ? "Completing..." : "Complete setup"}
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p
          className={`auth-feedback ${feedbackKind === "error" ? "is-error" : ""}`}
          data-testid="react-shell-setup-feedback"
        >
          {feedback}
        </p>
      ) : null}

      {isComplete ? (
        <div className="shell-actions setup-final-actions">
          <Link className="refresh-button" to={loginPath}>
            Continue to login
          </Link>
        </div>
      ) : null}
    </section>
  );
}
