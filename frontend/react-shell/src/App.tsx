import { QueryClientProvider } from "@tanstack/react-query";

import { AppRoutes } from "@react-shell/routes";
import { queryClient } from "@react-shell/react-query";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
