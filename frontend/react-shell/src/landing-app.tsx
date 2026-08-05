import { BrowserRouter } from "react-router-dom";

import { LandingRoute } from "@react-shell/landing-route";

export function LandingApp() {
  return (
    <BrowserRouter>
      <LandingRoute />
    </BrowserRouter>
  );
}
