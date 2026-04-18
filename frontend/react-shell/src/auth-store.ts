import { startTransition } from "react";

import type { AuthSessionResponse } from "@frontend-generated/shared-runtime-validation.mts";

import { create } from "zustand";

export type SessionUser = AuthSessionResponse["user"];

export type AuthState =
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

type AuthStore = {
  state: AuthState;
  setState(state: AuthState): void;
  updateAuthenticatedUser(user: SessionUser): void;
};

export const initialAuthState: AuthState = {
  status: "loading"
};

export const useAuthStore = create<AuthStore>((set) => ({
  state: initialAuthState,
  setState(state) {
    set({ state });
  },
  updateAuthenticatedUser(user) {
    set({
      state: {
        status: "authenticated",
        user
      }
    });
  }
}));

export function setAuthState(state: AuthState): void {
  startTransition(() => {
    useAuthStore.getState().setState(state);
  });
}

export function updateAuthenticatedUser(user: SessionUser): void {
  startTransition(() => {
    useAuthStore.getState().updateAuthenticatedUser(user);
  });
}
