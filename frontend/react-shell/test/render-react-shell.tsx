import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DEFAULT_LOCALE, setLocale } from "@frontend-i18n";

import { resetAuthState } from "@react-shell/auth-store";
import { createReactQueryClient } from "@react-shell/react-query";
import { AppRoutes } from "@react-shell/routes";

export function renderReactShell(path = "/react/") {
  window.history.replaceState({}, "", path);
  resetAuthState();
  setLocale(DEFAULT_LOCALE, {
    storage: window.localStorage,
    applyDocument: true
  });

  const queryClient = createReactQueryClient();
  const user = userEvent.setup();

  return {
    user,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    )
  };
}
