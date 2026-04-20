import { staticCssAssets } from "@frontend-generated/static-text-assets.mts";

const LEGACY_STYLE_ASSET_NAMES = ["style.css", "landing.css", "shell.css"] as const;
const LEGACY_STYLE_ATTRIBUTE = "data-react-legacy-style";

function ensureLegacyStyleAsset(name: (typeof LEGACY_STYLE_ASSET_NAMES)[number]): void {
  if (typeof document === "undefined") {
    return;
  }

  const existingStyle = document.head.querySelector<HTMLStyleElement>(
    `style[${LEGACY_STYLE_ATTRIBUTE}="${name}"]`
  );
  if (existingStyle) {
    return;
  }

  const content = staticCssAssets[name];
  if (!content) {
    return;
  }

  const style = document.createElement("style");
  style.setAttribute(LEGACY_STYLE_ATTRIBUTE, name);
  style.textContent = content;
  document.head.append(style);
}

export function ensureLegacyStyleAssets(): void {
  LEGACY_STYLE_ASSET_NAMES.forEach((name) => ensureLegacyStyleAsset(name));
}
