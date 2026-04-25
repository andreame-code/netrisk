import { staticCssAssets } from "@frontend-generated/static-text-assets.mts";

const SHARED_STYLE_ASSET_NAMES = ["style.css", "landing.css", "shell.css"] as const;
const SHARED_STYLE_ATTRIBUTE = "data-react-shared-style";

function ensureSharedStyleAsset(name: (typeof SHARED_STYLE_ASSET_NAMES)[number]): void {
  if (typeof document === "undefined") {
    return;
  }

  const existingStyle = document.head.querySelector<HTMLStyleElement>(
    `style[${SHARED_STYLE_ATTRIBUTE}="${name}"]`
  );
  if (existingStyle) {
    return;
  }

  const content = staticCssAssets[name];
  if (!content) {
    return;
  }

  const style = document.createElement("style");
  style.setAttribute(SHARED_STYLE_ATTRIBUTE, name);
  style.textContent = content;
  document.head.append(style);
}

export function ensureSharedStyleAssets(): void {
  SHARED_STYLE_ASSET_NAMES.forEach((name) => ensureSharedStyleAsset(name));
}
