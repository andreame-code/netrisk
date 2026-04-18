import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { getSession, login, logout } from "@frontend-core/api/client.mts";
import type { ApiClientError } from "@frontend-core/api/http.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import {
  initialAuthState,
  setAuthState,
  useAuthStore,
  type AuthState,
  type SessionUser
} from "@react-shell/auth-store";
import { applyShellTheme } from "@react-shell/theme";

type AuthContextValue = {
  state: AuthState;
  refresh(): Promise<void>;
  signIn(credentials: { username: string; password: string }): Promise<SessionUser>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requestMessages(scope: string) {
  return {
    errorMessage: `Unable to load ${scope}.`,
    fallbackMessage: `Unable to validate ${scope}.`
  };
}

function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof Error;
}

function isAuthRequired(error: unknown): boolean {
  return isApiClientError(error) && error.code === "AUTH_REQUIRED";
}

async function resolveSessionState(): Promise<AuthState> {
  try {
    const session = await getSession(requestMessages("session"));
    return {
      status: "authenticated",
      user: session.user
    };
  } catch (error) {
    if (isAuthRequired(error)) {
      return {
        status: "unauthenticated",
        message: "Sign in to continue."
      };
    }

    return {
      status: "error",
      message: messageFromError(error, "Unable to bootstrap the current session.")
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useAuthStore((store) => store.state);
  const requestIdRef = useRef(0);

  function commitState(nextState: AuthState): void {
    if (nextState.status === "authenticated") {
      applyShellTheme(nextState.user.preferences?.theme || null);
    }

    setAuthState(nextState);
  }

  useEffect(() => {
    let isActive = true;

    async function bootstrap(): Promise<void> {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setAuthState(initialAuthState);

      const nextState = await resolveSessionState();
      if (!isActive || requestIdRef.current !== requestId) {
        return;
      }

      commitState(nextState);
    }

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, []);

  async function refresh(): Promise<void> {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setAuthState(initialAuthState);

    const nextState = await resolveSessionState();
    if (requestIdRef.current !== requestId) {
      return;
    }

    commitState(nextState);
  }

  async function signIn(credentials: { username: string; password: string }): Promise<SessionUser> {
    const response = await login(credentials, requestMessages("credentials"));

    commitState({
      status: "authenticated",
      user: response.user
    });

    return response.user;
  }

  async function signOut(): Promise<void> {
    try {
      await logout(requestMessages("logout"));
    } catch (error) {
      if (!isAuthRequired(error)) {
        throw error;
      }
    }

    setAuthState({
      status: "unauthenticated",
      message: "Signed out."
    });
  }

  return (
    <AuthContext.Provider
      value={{
        state,
        refresh,
        signIn,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within the React shell auth provider.");
  }

  return context;
}
