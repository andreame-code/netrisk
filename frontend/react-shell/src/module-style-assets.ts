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

export function syncModuleStyleAssets(
  moduleOptions: ModuleOptionsResponse | null | undefined
): void {
  if (typeof document === "undefined" || !moduleOptions) {
    return;
  }

  const enabledIds = new Set((moduleOptions.enabledModules || []).map((moduleRef) => moduleRef.id));
  const hrefs = new Set<string>();

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
    const existingLink = document.head.querySelector<HTMLLinkElement>(
      `link[data-module-stylesheet="true"][href="${href}"]`
    );
    if (existingLink) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.moduleStylesheet = "true";
    document.head.appendChild(link);
  });
}
