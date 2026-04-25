import "./instrument";

import ReactDOM from "react-dom/client";

import { resolveLocale, setLocale } from "@frontend-i18n";

import { App } from "@react-shell/App";
import { createReactShellRootOptions } from "@react-shell/observability";
import { ensureSharedStyleAssets } from "@react-shell/shared-style-assets";
import { applyShellTheme, installShellThemeBridge } from "@react-shell/theme";

import "./styles.css";

setLocale(resolveLocale());
installShellThemeBridge();
applyShellTheme(null);
ensureSharedStyleAssets();

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("React shell root element not found.");
}

ReactDOM.createRoot(rootElement, createReactShellRootOptions()).render(<App />);
