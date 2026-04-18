import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";

import { getSession, login, logout } from "@frontend-core/api/client.mts";
import type { ApiClientError } from "@frontend-core/api/http.mts";
import { messageFromError } from "@frontend-core/errors.mts";

type SessionUser = Awaited<ReturnType<typeof getSession>>["user"];

type AuthState =
  | {
      status: "loading";
    }
  | {
      status: "authenticated";
      user: SessionUser;
    }
  | {
      status: "unauthenticated";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

type AuthContextValue = {
  state: AuthState;
  refresh(): Promise<void>;
  signIn(credentials: { username: string; password: string }): Promise<SessionUser>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  status: "loading"
};

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
  const [state, setState] = useState<AuthState>(initialState);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let isActive = true;

    async function bootstrap(): Promise<void> {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      startTransition(() => {
        setState(initialState);
      });

      const nextState = await resolveSessionState();
      if (!isActive || requestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setState(nextState);
      });
    }

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, []);

  async function refresh(): Promise<void> {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    startTransition(() => {
      setState(initialState);
    });

    const nextState = await resolveSessionState();
    if (requestIdRef.current !== requestId) {
      return;
    }

    startTransition(() => {
      setState(nextState);
    });
  }

  async function signIn(credentials: { username: string; password: string }): Promise<SessionUser> {
    const response = await login(credentials, requestMessages("credentials"));

    startTransition(() => {
      setState({
        status: "authenticated",
        user: response.user
      });
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

    startTransition(() => {
      setState({
        status: "unauthenticated",
        message: "Signed out."
      });
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
