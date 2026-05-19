import { setMarkup } from "./dom.mjs";
import { getModuleOptionsOrNull } from "./api/client.mjs";
import { resolvedUiSlots } from "./module-catalog.mjs";
import type {
  ModuleOptionsResponse,
  NetRiskUiSlotContribution
} from "../generated/shared-runtime-validation.mjs";

type MountModuleSlotSectionOptions = {
  slotId: string;
  containerId: string;
  anchor: HTMLElement | null;
  title: string;
  copy?: string;
  sectionClassName?: string;
};

let moduleOptionsPromise: Promise<ModuleOptionsResponse | null> | null = null;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchModuleOptions(): Promise<ModuleOptionsResponse | null> {
  if (moduleOptionsPromise) {
    return moduleOptionsPromise;
  }

  moduleOptionsPromise = getModuleOptionsOrNull({
    errorMessage: "Unable to load module options.",
    fallbackMessage: "Unable to validate module options."
  });

  return moduleOptionsPromise;
}

function slotCardMarkup(slot: NetRiskUiSlotContribution): string {
  const actionMarkup = slot.route
    ? `<a class="ghost-button profile-back-button" href="${escapeHtml(slot.route)}">Apri</a>`
    : "";

  return (
    `<article class="profile-note-card">` +
    `<div class="profile-games-head">` +
    `<div>` +
    `<p class="eyebrow profile-section-eyebrow">${escapeHtml(slot.kind)}</p>` +
    `<h3>${escapeHtml(slot.title)}</h3>` +
    `<p class="stage-copy">${escapeHtml(slot.description || "Estensione dichiarativa attiva nel runtime moduli.")}</p>` +
    `</div>` +
    `<div class="profile-game-meta-row">` +
    `<span class="badge">${escapeHtml(slot.slotId)}</span>` +
    actionMarkup +
    `</div>` +
    `</div>` +
    `</article>`
  );
}

function ensureSection(
  anchor: HTMLElement,
  containerId: string,
  sectionClassName: string
): HTMLElement {
  const existingSection = document.querySelector(`#${containerId}`) as HTMLElement | null;
  if (existingSection) {
    existingSection.className = sectionClassName;
    return existingSection;
  }

  const section = document.createElement("section");
  section.id = containerId;
  section.className = sectionClassName;
  anchor.insertAdjacentElement("afterend", section);
  return section;
}

export async function mountModuleSlotSection({
  slotId,
  containerId,
  anchor,
  title,
  copy = "",
  sectionClassName = "profile-preferences profile-note-card"
}: MountModuleSlotSectionOptions): Promise<void> {
  if (!anchor) {
    return;
  }

  const payload = await fetchModuleOptions();
  const slots = resolvedUiSlots(payload)
    .filter((slot) => slot.slotId === slotId)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

  const existingSection = document.querySelector(`#${containerId}`) as HTMLElement | null;
  if (!slots.length) {
    existingSection?.remove();
    return;
  }

  const section = ensureSection(anchor, containerId, sectionClassName);
  setMarkup(
    section,
    `<div class="profile-preferences-head">` +
      `<div>` +
      `<p class="eyebrow profile-section-eyebrow">${escapeHtml(slotId)}</p>` +
      `<h3>${escapeHtml(title)}</h3>` +
      `</div>` +
      `</div>` +
      (copy ? `<p class="stage-copy">${escapeHtml(copy)}</p>` : "") +
      `<div class="profile-games-list">` +
      slots.map((slot) => slotCardMarkup(slot)).join("") +
      `</div>`
  );
}
