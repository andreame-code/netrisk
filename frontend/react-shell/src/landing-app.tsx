import { BrowserRouter } from "react-router-dom";

import { LandingRoute } from "@react-shell/landing-route";

import "./landing-app.css";

export function LandingApp() {
  return (
    <BrowserRouter>
      <LandingRoute />
    </BrowserRouter>
  );
}
