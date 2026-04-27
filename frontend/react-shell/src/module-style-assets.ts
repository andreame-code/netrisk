import type { ModuleOptionsResponse } from "@frontend-generated/shared-runtime-validation.mts";

function resolveModuleStylesheetHref(moduleId: string, stylesheet: string): string | null {
  const trimmed = String(stylesheet || "").trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || /^\/\//.test(trimmed)) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `/modules/${encodeURIComponent(moduleId)}/${trimmed.replace(/^\.?\//, "")}`;
}

function resolveModuleThemeTokenText(themeTokens: string): string | null {
  const trimmed = String(themeTokens || "").trim();
  return trimmed ? trimmed : null;
}

export function syncModuleStyleAssets(
  moduleOptions: ModuleOptionsResponse | null | undefined
): void {
  if (typeof document === "undefined" || !moduleOptions) {
    return;
  }

  const enabledIds = new Set((moduleOptions.enabledModules || []).map((moduleRef) => moduleRef.id));
  const hrefs = new Set<string>();
  const themeTokenBlocks = new Map<string, string>();

  (moduleOptions.modules || []).forEach((moduleEntry) => {
    if (!enabledIds.has(moduleEntry.id)) {
      return;
    }

    const stylesheets = moduleEntry.clientManifest?.ui?.stylesheets || [];
    stylesheets.forEach((stylesheet) => {
      const href = resolveModuleStylesheetHref(moduleEntry.id, stylesheet);
      if (href) {
        hrefs.add(href);
      }
    });

    const themeTokens = moduleEntry.clientManifest?.ui?.themeTokens || [];
    themeTokens.forEach((tokenText, index) => {
      const text = resolveModuleThemeTokenText(tokenText);
      if (text) {
        themeTokenBlocks.set(`${moduleEntry.id}:${index}`, text);
      }
    });
  });

  const existingLinks = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[data-module-stylesheet="true"]')
  );
  existingLinks.forEach((link) => {
    const currentHref = link.getAttribute("href") || "";
    if (!hrefs.has(currentHref)) {
      link.remove();
    }
  });

  hrefs.forEach((href) => {
    const existingLink = existingLinks.find((link) => (link.getAttribute("href") || "") === href);
    if (existingLink) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.moduleStylesheet = "true";
    document.head.appendChild(link);
  });

  const existingThemeTokenStyles = Array.from(
    document.head.querySelectorAll<HTMLStyleElement>('style[data-module-theme-tokens="true"]')
  );
  existingThemeTokenStyles.forEach((styleElement) => {
    const key = styleElement.dataset.moduleThemeTokenKey || "";
    if (!themeTokenBlocks.has(key)) {
      styleElement.remove();
    }
  });

  themeTokenBlocks.forEach((text, key) => {
    const existingStyle = existingThemeTokenStyles.find(
      (styleElement) => styleElement.dataset.moduleThemeTokenKey === key
    );
    if (existingStyle) {
      if (existingStyle.textContent !== text) {
        existingStyle.textContent = text;
      }
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.dataset.moduleThemeTokens = "true";
    styleElement.dataset.moduleThemeTokenKey = key;
    styleElement.textContent = text;
    document.head.appendChild(styleElement);
  });
}
