import "./instrument";

import ReactDOM from "react-dom/client";

import { resolveLocale, setLocale } from "@frontend-i18n";

import { App } from "@react-shell/App";
import { ensureLegacyStyleAssets } from "@react-shell/legacy-style-assets";
import { createReactShellRootOptions } from "@react-shell/observability";
import { applyShellTheme } from "@react-shell/theme";

import "./styles.css";

setLocale(resolveLocale());
applyShellTheme(null);
ensureLegacyStyleAssets();

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("React shell root element not found.");
}

ReactDOM.createRoot(rootElement, createReactShellRootOptions()).render(<App />);
