import { QueryClientProvider } from "@tanstack/react-query";

import { AppRoutes } from "@react-shell/routes";
import { queryClient } from "@react-shell/react-query";
import { ShellErrorBoundary } from "@react-shell/shell-error-boundary";

import "./shell-app.css";

export function App() {
  return (
    <ShellErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </ShellErrorBoundary>
  );
}
