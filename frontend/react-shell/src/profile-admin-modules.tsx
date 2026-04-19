import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  InstalledModuleSummary,
  ModulesCatalogResponse,
  NetRiskModuleCapability,
  NetRiskUiSlotContribution
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  getModuleOptions,
  getModulesCatalog,
  rescanModules,
  setModuleEnabled
} from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { t } from "@frontend-i18n";

import {
  profileModuleOptionsQueryKey,
  profileModulesCatalogQueryKey
} from "@react-shell/react-query";

type CatalogFeedbackMode = "auto" | "updated" | "rescanned" | "error";

function moduleKindLabel(kind: string | null | undefined): string {
  if (!kind) {
    return t("profile.modules.kind.unknown");
  }

  return t(`profile.modules.kind.${kind}`, {}, { fallback: kind });
}

function moduleStateLabel(status: string | null | undefined): string {
  if (!status) {
    return t("profile.modules.state.discovered");
  }

  return t(`profile.modules.state.${status}`, {}, { fallback: status });
}

function moduleCompatibilityLabel(moduleEntry: InstalledModuleSummary): string {
  return moduleEntry.compatible
    ? t("profile.modules.state.compatible")
    : t("profile.modules.state.notCompatible");
}

function moduleIssuesLabel(moduleEntry: InstalledModuleSummary): string {
  const issues = [...moduleEntry.errors, ...moduleEntry.warnings].filter(Boolean);
  return issues.length ? issues.join(" | ") : t("profile.modules.issue.none");
}

function moduleDependencyLabel(
  dependency: NonNullable<InstalledModuleSummary["manifest"]>["dependencies"][number]
): string {
  const versionSuffix = dependency.version ? `@${dependency.version}` : "";
  const optionalSuffix = dependency.optional ? ` (${t("profile.modules.optional")})` : "";
  return `${dependency.id}${versionSuffix}${optionalSuffix}`;
}

function moduleCapabilityLabel(capability: NetRiskModuleCapability): string {
  const parts = [capability.kind];
  if (capability.scope) {
    parts.push(capability.scope);
  }
  if (capability.hook) {
    parts.push(capability.hook);
  }
  if (capability.targetId) {
    parts.push(capability.targetId);
  }
  return parts.filter(Boolean).join(" / ");
}

function moduleProfileLabels(moduleEntry: InstalledModuleSummary): string[] {
  const contentProfiles = moduleEntry.clientManifest?.profiles?.content || [];
  const gameplayProfiles = moduleEntry.clientManifest?.profiles?.gameplay || [];
  const uiProfiles = moduleEntry.clientManifest?.profiles?.ui || [];
  return [...contentProfiles, ...gameplayProfiles, ...uiProfiles].map(
    (profile) => profile.name || profile.id
  );
}

function moduleContributionLabels(moduleEntry: InstalledModuleSummary): string[] {
  const labels: string[] = [];
  const presets = moduleEntry.clientManifest?.gamePresets || [];
  const slots = moduleEntry.clientManifest?.ui?.slots || [];
  const stylesheets = moduleEntry.clientManifest?.ui?.stylesheets || [];
  const locales = moduleEntry.clientManifest?.ui?.locales || [];

  presets.forEach((preset) =>
    labels.push(`${t("profile.modules.presets")}: ${preset.name || preset.id}`)
  );
  slots.forEach((slot) =>
    labels.push(`${t("profile.modules.slots")}: ${slot.title || slot.itemId}`)
  );
  stylesheets.forEach((stylesheet) =>
    labels.push(`${t("profile.modules.stylesheets")}: ${stylesheet}`)
  );
  locales.forEach((locale) => labels.push(`${t("profile.modules.locales")}: ${locale}`));

  return labels;
}

function canToggleModule(moduleEntry: InstalledModuleSummary): boolean {
  if (moduleEntry.id === "core.base") {
    return false;
  }

  return moduleEntry.enabled || moduleEntry.compatible;
}

function catalogReadyMessage(payload: ModulesCatalogResponse | undefined): string {
  return t("profile.modules.status.ready", {
    count: payload?.modules.length || 0,
    engineVersion: payload?.engineVersion || "-"
  });
}

function adminSlots(optionsPayload: Awaited<ReturnType<typeof getModuleOptions>> | undefined) {
  return (optionsPayload?.uiSlots || []).filter((slot) => slot.slotId === "admin-modules-page");
}

function ModuleBadgeList({
  title,
  values,
  emptyLabel
}: {
  title: string;
  values: string[];
  emptyLabel: string;
}) {
  return (
    <div className="profile-module-badge-group">
      <span className="profile-module-badge-title">{title}</span>
      <div className="profile-module-badge-row">
        {values.length
          ? values.map((value) => (
              <span className="badge" key={`${title}-${value}`}>
                {value}
              </span>
            ))
          : [
              <span className="badge" key={`${title}-empty`}>
                {emptyLabel}
              </span>
            ]}
      </div>
    </div>
  );
}

function ProfileModuleCard({
  moduleEntry,
  disabled,
  onToggle
}: {
  moduleEntry: InstalledModuleSummary;
  disabled: boolean;
  onToggle(moduleId: string, enabled: boolean): void;
}) {
  const dependencies = (moduleEntry.manifest?.dependencies || []).map(moduleDependencyLabel);
  const conflicts = moduleEntry.manifest?.conflicts || [];
  const capabilities = moduleEntry.capabilities.map((capability) =>
    moduleCapabilityLabel(capability)
  );
  const profiles = moduleProfileLabels(moduleEntry);
  const contributions = moduleContributionLabels(moduleEntry);
  const toggleLabel = moduleEntry.enabled
    ? t("profile.modules.action.disable")
    : t("profile.modules.action.enable");

  return (
    <article
      className="profile-module-card"
      data-testid={`react-shell-profile-module-${moduleEntry.id}`}
    >
      <div className="card-header profile-pilot-card-header">
        <div>
          <p className="status-label">{moduleKindLabel(moduleEntry.kind)}</p>
          <h3>{moduleEntry.displayName}</h3>
          <p className="metric-copy">
            {moduleEntry.description || t("profile.modules.descriptionFallback")}
          </p>
        </div>
        <div className="profile-module-badges">
          <span className="badge">{moduleStateLabel(moduleEntry.status)}</span>
          <span className="badge">{moduleCompatibilityLabel(moduleEntry)}</span>
          {moduleEntry.enabled ? (
            <span className="badge accent">{t("profile.modules.state.enabled")}</span>
          ) : null}
        </div>
      </div>

      <div className="profile-module-details">
        <div className="profile-module-detail">
          <span>{t("profile.modules.detail.version")}</span>
          <strong>{moduleEntry.version || t("common.notAvailable")}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.detail.status")}</span>
          <strong>{moduleStateLabel(moduleEntry.status)}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.detail.source")}</span>
          <strong>{moduleEntry.sourcePath}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.detail.capabilities")}</span>
          <strong>{moduleEntry.capabilities.length}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.detail.dependencies")}</span>
          <strong>{moduleEntry.manifest?.dependencies?.length || 0}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.detail.issues")}</span>
          <strong>{moduleIssuesLabel(moduleEntry)}</strong>
        </div>
      </div>

      <ModuleBadgeList
        title={t("profile.modules.dependencies")}
        values={dependencies}
        emptyLabel={t("profile.modules.issue.none")}
      />
      <ModuleBadgeList
        title={t("profile.modules.conflicts")}
        values={conflicts}
        emptyLabel={t("profile.modules.issue.none")}
      />
      <ModuleBadgeList
        title={t("profile.modules.capabilities")}
        values={capabilities}
        emptyLabel={t("profile.modules.issue.none")}
      />
      <ModuleBadgeList
        title={t("profile.modules.profiles")}
        values={profiles}
        emptyLabel={t("profile.modules.issue.none")}
      />
      <ModuleBadgeList
        title={t("profile.modules.contributions")}
        values={contributions}
        emptyLabel={t("profile.modules.issue.none")}
      />

      <div className="shell-actions">
        {canToggleModule(moduleEntry) ? (
          <button
            type="button"
            className="ghost-action"
            onClick={() => onToggle(moduleEntry.id, !moduleEntry.enabled)}
            disabled={disabled}
            data-testid={`react-shell-profile-module-toggle-${moduleEntry.id}`}
          >
            {toggleLabel}
          </button>
        ) : (
          <span className="badge">{t("profile.modules.action.locked")}</span>
        )}
      </div>
    </article>
  );
}

function ProfileAdminSlotCard({ slot }: { slot: NetRiskUiSlotContribution }) {
  return (
    <article
      className="profile-module-card"
      data-testid={`react-shell-profile-module-slot-${slot.itemId}`}
    >
      <div className="card-header profile-pilot-card-header">
        <div>
          <p className="status-label">{slot.itemId}</p>
          <h3>{slot.title}</h3>
          <p className="metric-copy">
            {slot.description || t("profile.modules.descriptionFallback")}
          </p>
        </div>
        <div className="profile-module-badges">
          <span className="badge">{slot.kind}</span>
        </div>
      </div>

      <div className="profile-module-details">
        <div className="profile-module-detail">
          <span>{t("profile.modules.extensions.kind")}</span>
          <strong>{slot.kind}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.extensions.slot")}</span>
          <strong>{slot.slotId}</strong>
        </div>
        <div className="profile-module-detail">
          <span>{t("profile.modules.extensions.route")}</span>
          <strong>{slot.route || t("common.notAvailable")}</strong>
        </div>
      </div>

      {slot.route ? (
        <div className="shell-actions">
          <a className="ghost-action" href={slot.route}>
            {t("profile.modules.extensions.open")}
          </a>
        </div>
      ) : null}
    </article>
  );
}

export function ProfileAdminModules({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [statusMode, setStatusMode] = useState<CatalogFeedbackMode>("auto");
  const [statusErrorMessage, setStatusErrorMessage] = useState("");
  const [refreshPending, setRefreshPending] = useState(false);
  const [syncPending, setSyncPending] = useState(false);

  const catalogQuery = useQuery({
    queryKey: profileModulesCatalogQueryKey(userId),
    queryFn: () =>
      getModulesCatalog({
        errorMessage: t("profile.modules.status.error"),
        fallbackMessage: t("profile.modules.status.error")
      })
  });

  const moduleOptionsQuery = useQuery({
    queryKey: profileModuleOptionsQueryKey(userId),
    queryFn: () =>
      getModuleOptions({
        errorMessage: t("profile.modules.status.error"),
        fallbackMessage: t("profile.modules.status.error")
      })
  });

  const rescanMutation = useMutation({
    mutationFn: () =>
      rescanModules({
        errorMessage: t("profile.modules.status.error"),
        fallbackMessage: t("profile.modules.status.error")
      })
  });

  const toggleMutation = useMutation({
    mutationFn: ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) =>
      setModuleEnabled(moduleId, enabled, {
        errorMessage: t("profile.modules.status.error"),
        fallbackMessage: t("profile.modules.status.error")
      })
  });

  const modules = catalogQuery.data?.modules || [];
  const slots = adminSlots(moduleOptionsQuery.data);
  const actionPending =
    refreshPending ||
    syncPending ||
    rescanMutation.isPending ||
    toggleMutation.isPending ||
    catalogQuery.isPending ||
    moduleOptionsQuery.isPending;

  const statusMessage =
    statusMode === "updated"
      ? t("profile.modules.status.updated")
      : statusMode === "rescanned"
        ? t("profile.modules.status.rescanned")
        : statusMode === "error"
          ? statusErrorMessage ||
            messageFromError(catalogQuery.error, t("profile.modules.status.error"))
          : rescanMutation.isPending
            ? t("profile.modules.status.rescanning")
            : refreshPending || toggleMutation.isPending
              ? t("profile.modules.status.refreshing")
              : catalogQuery.isPending && !catalogQuery.data
                ? t("profile.modules.status.loading")
                : catalogQuery.isError
                  ? messageFromError(catalogQuery.error, t("profile.modules.status.error"))
                  : catalogReadyMessage(catalogQuery.data);

  async function syncModuleQueries(
    nextCatalog: ModulesCatalogResponse,
    nextMode: Extract<CatalogFeedbackMode, "updated" | "rescanned">
  ): Promise<void> {
    setSyncPending(true);

    try {
      queryClient.setQueryData(profileModulesCatalogQueryKey(userId), nextCatalog);
      const moduleOptionsResult = await moduleOptionsQuery.refetch();
      if (moduleOptionsResult.error) {
        throw moduleOptionsResult.error;
      }
      setStatusMode(nextMode);
      setStatusErrorMessage("");
    } finally {
      setSyncPending(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    setRefreshPending(true);
    setStatusMode("auto");
    setStatusErrorMessage("");

    try {
      const [catalogResult, moduleOptionsResult] = await Promise.all([
        catalogQuery.refetch(),
        moduleOptionsQuery.refetch()
      ]);
      if (catalogResult.error) {
        throw catalogResult.error;
      }
      if (moduleOptionsResult.error) {
        throw moduleOptionsResult.error;
      }
    } catch (error) {
      setStatusMode("error");
      setStatusErrorMessage(messageFromError(error, t("profile.modules.status.error")));
    } finally {
      setRefreshPending(false);
    }
  }

  async function handleRescan(): Promise<void> {
    setStatusMode("auto");
    setStatusErrorMessage("");

    try {
      const nextCatalog = await rescanMutation.mutateAsync();
      await syncModuleQueries(nextCatalog, "rescanned");
    } catch (error) {
      setStatusMode("error");
      setStatusErrorMessage(messageFromError(error, t("profile.modules.status.error")));
    }
  }

  async function handleToggle(moduleId: string, enabled: boolean): Promise<void> {
    setStatusMode("auto");
    setStatusErrorMessage("");

    try {
      const nextCatalog = await toggleMutation.mutateAsync({ moduleId, enabled });
      await syncModuleQueries(nextCatalog, "updated");
    } catch (error) {
      setStatusMode("error");
      setStatusErrorMessage(messageFromError(error, t("profile.modules.status.error")));
    }
  }

  return (
    <section
      className="placeholder-card profile-pilot-card profile-pilot-card-wide"
      data-testid="react-shell-profile-modules"
    >
      <div className="card-header profile-pilot-card-header">
        <div>
          <p className="status-label">{t("profile.modules.eyebrow")}</p>
          <h3>{t("profile.modules.heading")}</h3>
        </div>
        <span className="status-pill">{modules.length}</span>
      </div>

      <p className="metric-copy">{t("profile.modules.copy")}</p>

      <div className="shell-actions profile-module-toolbar">
        <button
          type="button"
          className="refresh-button"
          onClick={() => void handleRefresh()}
          disabled={actionPending}
          data-testid="react-shell-profile-modules-refresh"
        >
          {t("profile.modules.refresh")}
        </button>
        <button
          type="button"
          className="ghost-action"
          onClick={() => void handleRescan()}
          disabled={actionPending}
          data-testid="react-shell-profile-modules-rescan"
        >
          {t("profile.modules.rescan")}
        </button>
      </div>

      <p
        className={`profile-theme-status${statusMode === "error" || catalogQuery.isError ? " is-error" : ""}`}
        data-testid="react-shell-profile-modules-status"
      >
        {statusMessage}
      </p>

      <div className="profile-module-grid">
        <section className="profile-module-panel">
          <div className="card-header profile-pilot-card-header">
            <div>
              <p className="status-label">{t("profile.modules.eyebrow")}</p>
              <h3>{t("profile.modules.heading")}</h3>
            </div>
          </div>

          {catalogQuery.isPending && !catalogQuery.data ? (
            <div className="profile-query-state">
              <p className="metric-copy">{t("profile.modules.status.loading")}</p>
            </div>
          ) : catalogQuery.isError && !catalogQuery.data ? (
            <div className="profile-query-state profile-query-state-error">
              <p className="metric-copy">
                {messageFromError(catalogQuery.error, t("profile.modules.status.error"))}
              </p>
            </div>
          ) : !modules.length ? (
            <div className="profile-query-state">
              <p className="metric-copy">{t("profile.modules.empty")}</p>
            </div>
          ) : (
            <div className="profile-module-list">
              {modules.map((moduleEntry) => (
                <ProfileModuleCard
                  key={moduleEntry.id}
                  moduleEntry={moduleEntry}
                  disabled={actionPending}
                  onToggle={(moduleId, enabled) => void handleToggle(moduleId, enabled)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="profile-module-panel">
          <div className="card-header profile-pilot-card-header">
            <div>
              <p className="status-label">{t("profile.modules.extensions.eyebrow")}</p>
              <h3>{t("profile.modules.extensions.heading")}</h3>
            </div>
            <span className="status-pill">{slots.length}</span>
          </div>

          {moduleOptionsQuery.isPending && !moduleOptionsQuery.data ? (
            <div className="profile-query-state">
              <p className="metric-copy">{t("profile.modules.status.loading")}</p>
            </div>
          ) : moduleOptionsQuery.isError && !moduleOptionsQuery.data ? (
            <div className="profile-query-state profile-query-state-error">
              <p className="metric-copy">
                {messageFromError(moduleOptionsQuery.error, t("profile.modules.status.error"))}
              </p>
            </div>
          ) : !slots.length ? (
            <div className="profile-query-state">
              <p className="metric-copy">{t("profile.modules.extensions.empty")}</p>
            </div>
          ) : (
            <div className="profile-module-list">
              {slots.map((slot) => (
                <ProfileAdminSlotCard key={`${slot.slotId}-${slot.itemId}`} slot={slot} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
