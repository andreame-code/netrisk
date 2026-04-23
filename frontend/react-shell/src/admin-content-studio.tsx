import { useDeferredValue, useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminAuthoredModuleDetailResponse,
  AdminAuthoredModuleUpsertRequest,
  AuthoredMapOption,
  AuthoredVictoryObjective
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  createAdminAuthoredModule,
  disableAdminAuthoredModule,
  enableAdminAuthoredModule,
  getAdminAuthoredModule,
  getAdminContentStudioOptions,
  listAdminAuthoredModules,
  publishAdminAuthoredModule,
  updateAdminAuthoredModule,
  validateAdminAuthoredModule
} from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate } from "@frontend-i18n";

import {
  adminContentStudioModuleDetailQueryKey,
  adminContentStudioModulesQueryKey,
  adminContentStudioOptionsQueryKey,
  gameOptionsQueryKey
} from "@react-shell/react-query";

type AdminFrameContext = {
  basePath: string;
  currentUser: {
    id: string;
    username: string;
    role?: string | null;
  };
  environmentLabel: string;
  hostLabel: string;
  sectionLabel: string;
};

type ContentStudioInspection = Pick<
  AdminAuthoredModuleDetailResponse,
  "validation" | "preview" | "runtime"
>;

type EditorDraft = AdminAuthoredModuleUpsertRequest & {
  status?: "draft" | "published" | "disabled";
  createdAt?: string;
  updatedAt?: string;
};

const NEW_MODULE_KEY = "__content-studio-new__";

function requestMessages(scope: string) {
  return {
    errorMessage: `Unable to load ${scope}.`,
    fallbackMessage: `Unable to validate ${scope}.`
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }

  return formatDate(parsed, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function moduleStatusTone(status: string | null | undefined): "accent" | "danger" | "muted" {
  if (status === "published") {
    return "accent";
  }

  if (status === "disabled") {
    return "danger";
  }

  return "muted";
}

function validationTone(valid: boolean | null | undefined): "success" | "warning" {
  return valid ? "success" : "warning";
}

function firstMap(options: { maps: AuthoredMapOption[] } | undefined): AuthoredMapOption | null {
  return options?.maps?.[0] || null;
}

function createObjectiveId(index: number): string {
  return `objective-${index + 1}`;
}

function createNextObjectiveIndex(objectives: AuthoredVictoryObjective[]): number {
  let index = objectives.length;

  while (objectives.some((objective) => objective.id === createObjectiveId(index))) {
    index += 1;
  }

  return index;
}
function createObjective(
  index: number,
  type: AuthoredVictoryObjective["type"]
): AuthoredVictoryObjective {
  if (type === "control-territory-count") {
    return {
      id: createObjectiveId(index),
      title: `Territory control ${index + 1}`,
      description: "Own the configured number of territories.",
      enabled: true,
      type,
      territoryCount: 24
    };
  }

  return {
    id: createObjectiveId(index),
    title: `Continent control ${index + 1}`,
    description: "Control the selected continents at the same time.",
    enabled: true,
    type,
    continentIds: []
  };
}

function createDefaultModuleId(existingModuleIds: string[]): string {
  const baseId = "victory.new-draft";
  if (!existingModuleIds.includes(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingModuleIds.includes(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function createEmptyDraft(
  mapOption: AuthoredMapOption | null,
  existingModuleIds: string[] = []
): EditorDraft {
  return {
    id: createDefaultModuleId(existingModuleIds),
    name: "",
    description: "",
    version: "1.0.0",
    moduleType: "victory-objectives",
    content: {
      mapId: mapOption?.id || "",
      objectives: [createObjective(0, "control-continents")]
    }
  };
}

function toUpsertRequest(draft: EditorDraft): AdminAuthoredModuleUpsertRequest {
  return {
    id: draft.id,
    name: draft.name,
    description: draft.description,
    version: draft.version,
    moduleType: draft.moduleType,
    content: {
      mapId: draft.content.mapId,
      objectives: draft.content.objectives.map((objective) => clone(objective))
    }
  };
}

function currentInspection(
  detail: AdminAuthoredModuleDetailResponse | undefined,
  inspection: ContentStudioInspection | null
): ContentStudioInspection | null {
  if (inspection) {
    return inspection;
  }

  if (!detail) {
    return null;
  }

  return {
    validation: detail.validation,
    preview: detail.preview,
    runtime: detail.runtime
  };
}

function moduleStatusLabel(status: string | null | undefined): string {
  if (status === "published") {
    return "Published";
  }

  if (status === "disabled") {
    return "Disabled";
  }

  return "Draft";
}

function objectiveTypeLabel(type: AuthoredVictoryObjective["type"]): string {
  return type === "control-territory-count" ? "Territory count" : "Specific continents";
}

function ValidationPanel({ inspection }: { inspection: ContentStudioInspection | null }) {
  const errors = inspection?.validation.errors || [];
  const warnings = inspection?.validation.warnings || [];

  return (
    <section className="card-panel content-studio-side-panel">
      <div className="card-header">
        <div>
          <p className="status-label">Validation</p>
          <h3>Publish gate</h3>
        </div>
        <span className={`badge ${inspection?.validation.valid ? "success" : "warning"}`}>
          {inspection?.validation.valid ? "Ready to publish" : "Needs fixes"}
        </span>
      </div>
      {!errors.length && !warnings.length ? (
        <p className="admin-item-meta">No validation issues detected for the current draft.</p>
      ) : (
        <ul className="content-studio-validation-list">
          {errors.map((entry) => (
            <li
              key={`${entry.path}-${entry.code}`}
              className="content-studio-validation-item is-error"
            >
              <strong>{entry.code}</strong>
              <p>{entry.message}</p>
              <span>{entry.path}</span>
            </li>
          ))}
          {warnings.map((entry) => (
            <li
              key={`${entry.path}-${entry.code}`}
              className="content-studio-validation-item is-warning"
            >
              <strong>{entry.code}</strong>
              <p>{entry.message}</p>
              <span>{entry.path}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewPanel({ inspection }: { inspection: ContentStudioInspection | null }) {
  return (
    <section className="card-panel content-studio-side-panel">
      <div className="card-header">
        <div>
          <p className="status-label">Live preview</p>
          <h3>Player-facing summary</h3>
        </div>
      </div>
      <p className="content-studio-summary">{inspection?.preview.summary || "No preview yet."}</p>
      <ul className="content-studio-preview-list">
        {(inspection?.preview.objectiveSummaries || []).map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ul>
    </section>
  );
}

function RuntimePanel({ inspection }: { inspection: ContentStudioInspection | null }) {
  return (
    <section className="card-panel content-studio-side-panel">
      <div className="card-header">
        <div>
          <p className="status-label">Generated runtime</p>
          <h3>Engine-ready JSON</h3>
        </div>
      </div>
      <pre className="content-studio-runtime-json">
        {JSON.stringify(inspection?.runtime || {}, null, 2)}
      </pre>
    </section>
  );
}

export function AdminContentStudioSection({ frameContext }: { frameContext: AdminFrameContext }) {
  const queryClient = useQueryClient();
  const [selectedEditorKey, setSelectedEditorKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [inspection, setInspection] = useState<ContentStudioInspection | null>(null);
  const [activeObjectiveId, setActiveObjectiveId] = useState<string | null>(null);
  const selectedModuleId =
    selectedEditorKey && selectedEditorKey !== NEW_MODULE_KEY ? selectedEditorKey : null;
  const isNewDraft = selectedEditorKey === NEW_MODULE_KEY;

  const optionsQuery = useQuery({
    queryKey: adminContentStudioOptionsQueryKey(),
    queryFn: () => getAdminContentStudioOptions(requestMessages("Content Studio options"))
  });

  const modulesQuery = useQuery({
    queryKey: adminContentStudioModulesQueryKey(),
    queryFn: () => listAdminAuthoredModules(requestMessages("Content Studio modules"))
  });

  const detailQuery = useQuery({
    queryKey: adminContentStudioModuleDetailQueryKey(selectedModuleId),
    queryFn: () =>
      getAdminAuthoredModule(
        selectedModuleId as string,
        requestMessages(`module ${selectedModuleId || ""}`)
      ),
    enabled: Boolean(selectedModuleId)
  });

  const authoredModules = modulesQuery.data?.modules || [];
  const deferredDraft = useDeferredValue(draft);

  useEffect(() => {
    if (selectedEditorKey !== null || !modulesQuery.data) {
      return;
    }

    setSelectedEditorKey(modulesQuery.data.modules[0]?.id || NEW_MODULE_KEY);
  }, [modulesQuery.data, selectedEditorKey]);

  useEffect(() => {
    if (!isNewDraft || !optionsQuery.data || draft) {
      return;
    }

    const nextDraft = createEmptyDraft(
      firstMap(optionsQuery.data),
      authoredModules.map((entry) => entry.id)
    );
    setDraft(nextDraft);
    setInspection(null);
    setActiveObjectiveId(nextDraft.content.objectives[0]?.id || null);
  }, [authoredModules, draft, isNewDraft, optionsQuery.data]);

  useEffect(() => {
    if (!detailQuery.data || !selectedModuleId) {
      return;
    }

    setDraft(clone(detailQuery.data.module));
    setInspection({
      validation: detailQuery.data.validation,
      preview: detailQuery.data.preview,
      runtime: detailQuery.data.runtime
    });
    setActiveObjectiveId(detailQuery.data.module.content.objectives[0]?.id || null);
  }, [detailQuery.data, selectedModuleId]);

  useEffect(() => {
    if (!draft?.content.objectives.length) {
      setActiveObjectiveId(null);
      return;
    }

    if (
      !activeObjectiveId ||
      !draft.content.objectives.some((entry) => entry.id === activeObjectiveId)
    ) {
      setActiveObjectiveId(draft.content.objectives[0]?.id || null);
    }
  }, [activeObjectiveId, draft]);

  const listMutationKeys = [
    adminContentStudioModulesQueryKey(),
    adminContentStudioModuleDetailQueryKey(selectedModuleId),
    gameOptionsQueryKey()
  ];

  const validateMutation = useMutation({
    mutationFn: (request: AdminAuthoredModuleUpsertRequest) =>
      validateAdminAuthoredModule(request, requestMessages("module draft")),
    onSuccess(payload) {
      setInspection(payload);
    }
  });

  const saveMutation = useMutation({
    mutationFn: (request: AdminAuthoredModuleUpsertRequest) =>
      selectedModuleId
        ? updateAdminAuthoredModule(selectedModuleId, request, requestMessages("module draft"))
        : createAdminAuthoredModule(request, requestMessages("module draft")),
    onSuccess(payload) {
      setSelectedEditorKey(payload.module.id);
      setDraft(clone(payload.module));
      setInspection({
        validation: payload.validation,
        preview: payload.preview,
        runtime: payload.runtime
      });
      setActiveObjectiveId(payload.module.content.objectives[0]?.id || null);
      listMutationKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    }
  });

  const publishMutation = useMutation({
    mutationFn: (moduleId: string) =>
      publishAdminAuthoredModule(moduleId, requestMessages(`module ${moduleId}`)),
    onSuccess(payload) {
      setDraft(clone(payload.module));
      setInspection({
        validation: payload.validation,
        preview: payload.preview,
        runtime: payload.runtime
      });
      listMutationKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    }
  });

  const enableMutation = useMutation({
    mutationFn: (moduleId: string) =>
      enableAdminAuthoredModule(moduleId, requestMessages(`module ${moduleId}`)),
    onSuccess(payload) {
      setDraft(clone(payload.module));
      setInspection({
        validation: payload.validation,
        preview: payload.preview,
        runtime: payload.runtime
      });
      listMutationKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    }
  });

  const disableMutation = useMutation({
    mutationFn: (moduleId: string) =>
      disableAdminAuthoredModule(moduleId, requestMessages(`module ${moduleId}`)),
    onSuccess(payload) {
      setDraft(clone(payload.module));
      setInspection({
        validation: payload.validation,
        preview: payload.preview,
        runtime: payload.runtime
      });
      listMutationKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    }
  });

  useEffect(() => {
    if (!deferredDraft) {
      return;
    }

    const isEditableDraft = isNewDraft || detailQuery.data?.module.status === "draft";
    if (!isEditableDraft) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      validateMutation.mutate(toUpsertRequest(clone(deferredDraft)));
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [deferredDraft, detailQuery.data?.module.status, isNewDraft]);

  function startNewDraft() {
    const nextDraft = createEmptyDraft(
      firstMap(optionsQuery.data),
      authoredModules.map((entry) => entry.id)
    );
    setSelectedEditorKey(NEW_MODULE_KEY);
    setDraft(nextDraft);
    setInspection(null);
    setActiveObjectiveId(nextDraft.content.objectives[0]?.id || null);
  }

  function updateDraft(nextDraft: EditorDraft) {
    setDraft(nextDraft);
  }

  function updateModuleField<K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) {
    if (!draft) {
      return;
    }

    updateDraft({
      ...draft,
      [key]: value
    });
  }

  function updateObjective(
    objectiveId: string,
    transform: (objective: AuthoredVictoryObjective) => AuthoredVictoryObjective
  ) {
    if (!draft) {
      return;
    }

    updateDraft({
      ...draft,
      content: {
        ...draft.content,
        objectives: draft.content.objectives.map((objective) =>
          objective.id === objectiveId ? transform(objective) : objective
        )
      }
    });
  }

  function addObjective(type: AuthoredVictoryObjective["type"]) {
    if (!draft) {
      return;
    }

    const nextObjective = createObjective(createNextObjectiveIndex(draft.content.objectives), type);
    updateDraft({
      ...draft,
      content: {
        ...draft.content,
        objectives: [...draft.content.objectives, nextObjective]
      }
    });
    setActiveObjectiveId(nextObjective.id);
  }

  function removeObjective(objectiveId: string) {
    if (!draft) {
      return;
    }

    const confirmed = window.confirm(
      `Remove objective "${objectiveId}" from this draft? This change is not reversible.`
    );
    if (!confirmed) {
      return;
    }

    const nextObjectives = draft.content.objectives.filter(
      (objective) => objective.id !== objectiveId
    );
    updateDraft({
      ...draft,
      content: {
        ...draft.content,
        objectives: nextObjectives
      }
    });
    setActiveObjectiveId(nextObjectives[0]?.id || null);
  }

  function handleSaveDraft() {
    if (!draft) {
      return;
    }

    saveMutation.mutate(toUpsertRequest(clone(draft)));
  }

  function handlePublish() {
    if (!selectedModuleId) {
      return;
    }

    publishMutation.mutate(selectedModuleId);
  }

  function handleDisable() {
    if (!selectedModuleId || !draft) {
      return;
    }

    const confirmed = window.confirm(
      `Disable published module "${draft.name || draft.id}"? Active games and admin defaults will be checked before the change is applied.`
    );
    if (!confirmed) {
      return;
    }

    disableMutation.mutate(selectedModuleId);
  }

  function handleEnable() {
    if (!selectedModuleId) {
      return;
    }

    enableMutation.mutate(selectedModuleId);
  }

  const selectedMap =
    optionsQuery.data?.maps.find((entry) => entry.id === draft?.content.mapId) || null;
  const activeObjective =
    draft?.content.objectives.find((objective) => objective.id === activeObjectiveId) || null;
  const latestInspection = currentInspection(detailQuery.data, inspection);
  const modules = authoredModules;
  const isEditableDraft = Boolean(
    draft && (isNewDraft || detailQuery.data?.module.status === "draft")
  );
  const isBusy =
    validateMutation.isPending ||
    saveMutation.isPending ||
    publishMutation.isPending ||
    enableMutation.isPending ||
    disableMutation.isPending;
  const moduleIdLocked = Boolean(selectedModuleId);

  if (optionsQuery.isLoading || modulesQuery.isLoading || selectedEditorKey === null) {
    return (
      <section className="status-panel">
        <p className="status-label">Content Studio</p>
        <h2>Loading authoring workspace</h2>
        <p className="status-copy">
          Reading published modules, draft metadata, and map authoring options.
        </p>
      </section>
    );
  }

  if (optionsQuery.isError || modulesQuery.isError) {
    return (
      <section className="status-panel status-panel-error">
        <p className="status-label">Content Studio</p>
        <h2>Authoring workspace unavailable</h2>
        <p className="status-copy">
          {messageFromError(
            optionsQuery.error || modulesQuery.error,
            "Unable to load the Content Studio workspace."
          )}
        </p>
      </section>
    );
  }

  return (
    <div className="admin-section-stack" data-testid="admin-content-studio">
      <section className="hero-panel admin-hero-panel admin-page-header">
        <div className="admin-hero-copy">
          <div className="admin-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span>
            <span>Content Studio</span>
          </div>
          <p className="status-label">Content Studio</p>
          <h1>Author victory objective modules</h1>
          <p className="status-copy">
            Create validated, publishable objective packs without editing source files. Published
            modules flow into the runtime victory-rule catalog and are stored for engine use.
          </p>
        </div>
        <div className="admin-hero-side">
          <section className="admin-context-panel" aria-label="Operator session">
            <p className="status-label">Operator</p>
            <p className="admin-context-copy">
              {frameContext.currentUser.username} · {frameContext.environmentLabel}
            </p>
            <div className="admin-toolbar-summary">
              <span className="chip">Maps {optionsQuery.data?.maps.length || 0}</span>
              <span className="chip">Modules {modules.length}</span>
              <span className="chip">Type victory-objectives</span>
            </div>
          </section>
          <div className="hero-actions admin-hero-actions">
            <button type="button" className="refresh-button" onClick={startNewDraft}>
              New draft
            </button>
          </div>
        </div>
      </section>

      <section className="card-panel admin-toolbar-panel admin-toolbar-panel-sticky">
        <div className="admin-toolbar admin-toolbar-dense">
          <div className="admin-toolbar-summary">
            <span
              className={`chip ${moduleStatusTone(draft?.status || detailQuery.data?.module.status)}`}
            >
              {moduleStatusLabel(draft?.status || detailQuery.data?.module.status)}
            </span>
            <span className={`chip ${validationTone(latestInspection?.validation.valid)}`}>
              {latestInspection?.validation.valid ? "Valid" : "Validation pending"}
            </span>
            <span className="chip">Objectives {draft?.content.objectives.length || 0}</span>
            <span className="chip">
              Updated {formatTimestamp((detailQuery.data?.module || null)?.updatedAt)}
            </span>
          </div>
          <div className="admin-inline-actions">
            <button
              type="button"
              className="refresh-button"
              onClick={handleSaveDraft}
              disabled={!draft || !isEditableDraft || isBusy}
            >
              {saveMutation.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="ghost-action"
              onClick={handlePublish}
              disabled={
                !selectedModuleId ||
                !draft ||
                draft.status !== "draft" ||
                !latestInspection?.validation.valid ||
                isBusy
              }
            >
              {publishMutation.isPending ? "Publishing…" : "Publish"}
            </button>
            <button
              type="button"
              className="ghost-action"
              onClick={handleEnable}
              disabled={!selectedModuleId || draft?.status !== "disabled" || isBusy}
            >
              {enableMutation.isPending ? "Enabling…" : "Enable"}
            </button>
            <button
              type="button"
              className="ghost-action"
              onClick={handleDisable}
              disabled={!selectedModuleId || draft?.status !== "published" || isBusy}
            >
              {disableMutation.isPending ? "Disabling…" : "Disable"}
            </button>
          </div>
        </div>
      </section>

      {saveMutation.isError ||
      publishMutation.isError ||
      enableMutation.isError ||
      disableMutation.isError ? (
        <section className="status-panel status-panel-error">
          <p className="status-label">Content Studio</p>
          <h2>Last mutation failed</h2>
          <p className="status-copy">
            {messageFromError(
              saveMutation.error ||
                publishMutation.error ||
                enableMutation.error ||
                disableMutation.error,
              "Unable to apply the requested module change."
            )}
          </p>
        </section>
      ) : null}

      <div className="content-studio-grid">
        <section className="card-panel content-studio-list-panel">
          <div className="card-header">
            <div>
              <p className="status-label">Catalog</p>
              <h2>Authored modules</h2>
            </div>
          </div>
          <div className="content-studio-list">
            {modules.length ? (
              modules.map((moduleEntry) => (
                <button
                  key={moduleEntry.id}
                  type="button"
                  className={`admin-list-button${
                    selectedModuleId === moduleEntry.id ? " is-selected" : ""
                  }`}
                  onClick={() => setSelectedEditorKey(moduleEntry.id)}
                >
                  <div className="admin-list-copy">
                    <strong>{moduleEntry.name}</strong>
                    <span>{moduleEntry.description}</span>
                    <span className="admin-item-meta">
                      {moduleEntry.id} · {moduleStatusLabel(moduleEntry.status)} · updated{" "}
                      {formatTimestamp(moduleEntry.updatedAt)}
                    </span>
                  </div>
                  <div className="content-studio-list-meta">
                    <span className={`badge ${moduleStatusTone(moduleEntry.status)}`}>
                      {moduleStatusLabel(moduleEntry.status)}
                    </span>
                    <span className={`badge ${validationTone(moduleEntry.validation.valid)}`}>
                      {moduleEntry.validation.valid ? "valid" : "draft"}
                    </span>
                    <span className="badge">{moduleEntry.enabledObjectiveCount} enabled</span>
                  </div>
                </button>
              ))
            ) : (
              <section className="status-panel admin-empty-state">
                <p className="status-label">Content Studio</p>
                <h2>No authored modules yet</h2>
                <p className="status-copy">
                  Start with a draft victory-objective module and publish it when validation is
                  clean.
                </p>
              </section>
            )}
          </div>
        </section>

        <section className="content-studio-editor-shell">
          {detailQuery.isLoading && selectedModuleId ? (
            <section className="status-panel">
              <p className="status-label">Content Studio</p>
              <h2>Loading module</h2>
              <p className="status-copy">Fetching the selected draft and runtime preview.</p>
            </section>
          ) : detailQuery.isError && selectedModuleId ? (
            <section className="status-panel status-panel-error">
              <p className="status-label">Content Studio</p>
              <h2>Module unavailable</h2>
              <p className="status-copy">
                {messageFromError(detailQuery.error, "Unable to load the selected module.")}
              </p>
            </section>
          ) : !draft ? (
            <section className="status-panel">
              <p className="status-label">Content Studio</p>
              <h2>Select or create a module</h2>
              <p className="status-copy">
                Choose an authored module from the list or start a fresh draft.
              </p>
            </section>
          ) : (
            <div className="content-studio-editor-grid">
              <div className="content-studio-main-panel">
                <section className="card-panel content-studio-form-panel">
                  <div className="card-header">
                    <div>
                      <p className="status-label">Module</p>
                      <h2>Definition</h2>
                    </div>
                  </div>
                  <div className="admin-form-grid admin-form-grid-2">
                    <label className="shell-field admin-field">
                      <span>Module id</span>
                      <input
                        value={draft.id}
                        onChange={(event) => updateModuleField("id", event.target.value)}
                        disabled={moduleIdLocked}
                      />
                      <small>
                        {moduleIdLocked
                          ? "Module id is locked after the first saved draft in this phase."
                          : "Stable runtime identifier."}
                      </small>
                    </label>
                    <label className="shell-field admin-field">
                      <span>Version</span>
                      <input
                        value={draft.version}
                        onChange={(event) => updateModuleField("version", event.target.value)}
                        disabled={!isEditableDraft}
                      />
                    </label>
                    <label className="shell-field admin-field">
                      <span>Name</span>
                      <input
                        value={draft.name}
                        onChange={(event) => updateModuleField("name", event.target.value)}
                        disabled={!isEditableDraft}
                      />
                    </label>
                    <label className="shell-field admin-field">
                      <span>Target map</span>
                      <select
                        value={draft.content.mapId}
                        onChange={(event) =>
                          updateDraft({
                            ...draft,
                            content: {
                              ...draft.content,
                              mapId: event.target.value
                            }
                          })
                        }
                        disabled={!isEditableDraft}
                      >
                        <option value="">Select a map</option>
                        {optionsQuery.data?.maps.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="shell-field admin-field admin-card-span">
                      <span>Description</span>
                      <textarea
                        rows={3}
                        value={draft.description}
                        onChange={(event) => updateModuleField("description", event.target.value)}
                        disabled={!isEditableDraft}
                      />
                    </label>
                  </div>
                  <div className="content-studio-map-meta">
                    <span className="chip">{selectedMap?.name || "No map selected"}</span>
                    <span className="chip">Territories {selectedMap?.territoryCount || 0}</span>
                    <span className="chip">Continents {selectedMap?.continentCount || 0}</span>
                  </div>
                </section>

                <section className="card-panel content-studio-form-panel">
                  <div className="card-header">
                    <div>
                      <p className="status-label">Objectives</p>
                      <h2>Victory conditions</h2>
                    </div>
                    <div className="admin-inline-actions">
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => addObjective("control-continents")}
                        disabled={!isEditableDraft}
                      >
                        Add continent objective
                      </button>
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => addObjective("control-territory-count")}
                        disabled={!isEditableDraft}
                      >
                        Add territory objective
                      </button>
                    </div>
                  </div>

                  <div className="content-studio-objective-layout">
                    <div className="content-studio-objective-list">
                      {draft.content.objectives.map((objective, index) => (
                        <button
                          key={objective.id}
                          type="button"
                          className={`admin-list-button${
                            activeObjectiveId === objective.id ? " is-selected" : ""
                          }`}
                          onClick={() => setActiveObjectiveId(objective.id)}
                        >
                          <div className="admin-list-copy">
                            <strong>{objective.title || `Objective ${index + 1}`}</strong>
                            <span>
                              {objective.description || "No player-facing description yet."}
                            </span>
                            <span className="admin-item-meta">
                              {objective.id || "missing-id"} · {objectiveTypeLabel(objective.type)}
                            </span>
                          </div>
                          <div className="content-studio-list-meta">
                            <span className={`badge ${objective.enabled ? "success" : "muted"}`}>
                              {objective.enabled ? "Enabled" : "Off"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {activeObjective ? (
                      <div className="content-studio-objective-editor">
                        <div className="admin-form-grid admin-form-grid-2">
                          <label className="shell-field admin-field">
                            <span>Objective id</span>
                            <input
                              value={activeObjective.id}
                              onChange={(event) =>
                                updateObjective(activeObjective.id, (objective) => ({
                                  ...objective,
                                  id: event.target.value
                                }))
                              }
                              disabled={!isEditableDraft}
                            />
                          </label>
                          <label className="shell-field admin-field">
                            <span>Objective type</span>
                            <select
                              value={activeObjective.type}
                              onChange={(event) =>
                                updateObjective(activeObjective.id, (objective) => {
                                  const baseObjective = {
                                    id: objective.id,
                                    title: objective.title,
                                    description: objective.description,
                                    enabled: objective.enabled
                                  };

                                  return event.target.value === "control-territory-count"
                                    ? {
                                        ...baseObjective,
                                        type: "control-territory-count",
                                        territoryCount:
                                          objective.type === "control-territory-count"
                                            ? objective.territoryCount
                                            : 24
                                      }
                                    : {
                                        ...baseObjective,
                                        type: "control-continents",
                                        continentIds:
                                          objective.type === "control-continents"
                                            ? objective.continentIds
                                            : []
                                      };
                                })
                              }
                              disabled={!isEditableDraft}
                            >
                              <option value="control-continents">
                                Control specific continents
                              </option>
                              <option value="control-territory-count">
                                Control minimum territory count
                              </option>
                            </select>
                          </label>
                          <label className="shell-field admin-field">
                            <span>Title</span>
                            <input
                              value={activeObjective.title}
                              onChange={(event) =>
                                updateObjective(activeObjective.id, (objective) => ({
                                  ...objective,
                                  title: event.target.value
                                }))
                              }
                              disabled={!isEditableDraft}
                            />
                          </label>
                          <label className="shell-field admin-field">
                            <span>Enabled</span>
                            <select
                              value={activeObjective.enabled ? "true" : "false"}
                              onChange={(event) =>
                                updateObjective(activeObjective.id, (objective) => ({
                                  ...objective,
                                  enabled: event.target.value === "true"
                                }))
                              }
                              disabled={!isEditableDraft}
                            >
                              <option value="true">Enabled</option>
                              <option value="false">Disabled</option>
                            </select>
                          </label>
                          <label className="shell-field admin-field admin-card-span">
                            <span>Player-facing description</span>
                            <textarea
                              rows={3}
                              value={activeObjective.description}
                              onChange={(event) =>
                                updateObjective(activeObjective.id, (objective) => ({
                                  ...objective,
                                  description: event.target.value
                                }))
                              }
                              disabled={!isEditableDraft}
                            />
                          </label>
                        </div>

                        {activeObjective.type === "control-continents" ? (
                          <div className="content-studio-chip-group">
                            <p className="admin-item-meta">
                              Select one or more continents from the active map.
                            </p>
                            <div className="content-studio-chip-row">
                              {(selectedMap?.continents || []).map((continent) => {
                                const selected = activeObjective.continentIds.includes(
                                  continent.id
                                );
                                return (
                                  <button
                                    key={continent.id}
                                    type="button"
                                    className={`content-studio-chip${selected ? " is-selected" : ""}`}
                                    onClick={() =>
                                      updateObjective(activeObjective.id, (objective) => {
                                        if (objective.type !== "control-continents") {
                                          return objective;
                                        }

                                        return {
                                          ...objective,
                                          continentIds: selected
                                            ? objective.continentIds.filter(
                                                (entry) => entry !== continent.id
                                              )
                                            : [...objective.continentIds, continent.id]
                                        };
                                      })
                                    }
                                    disabled={!isEditableDraft}
                                  >
                                    <strong>{continent.name}</strong>
                                    <span>
                                      {continent.territoryCount} territories · bonus{" "}
                                      {continent.bonus}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <label className="shell-field admin-field">
                            <span>Minimum territory count</span>
                            <input
                              type="number"
                              min={1}
                              max={selectedMap?.territoryCount || 42}
                              value={String(activeObjective.territoryCount)}
                              onChange={(event) =>
                                updateObjective(activeObjective.id, (objective) =>
                                  objective.type !== "control-territory-count"
                                    ? objective
                                    : {
                                        ...objective,
                                        territoryCount: Number(event.target.value || "0")
                                      }
                                )
                              }
                              disabled={!isEditableDraft}
                            />
                            <small>
                              Must be between 1 and {selectedMap?.territoryCount || "the map limit"}
                              .
                            </small>
                          </label>
                        )}

                        <div className="admin-inline-actions">
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => removeObjective(activeObjective.id)}
                            disabled={!isEditableDraft}
                          >
                            Remove objective
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                {!isEditableDraft && selectedModuleId ? (
                  <section className="status-panel">
                    <p className="status-label">Read only</p>
                    <h2>Published modules are locked</h2>
                    <p className="status-copy">
                      This phase allows editing saved drafts. Published or disabled modules can be
                      reviewed, enabled, or disabled, but not rewritten in place.
                    </p>
                  </section>
                ) : null}
              </div>

              <div className="content-studio-side-stack">
                <PreviewPanel inspection={latestInspection} />
                <ValidationPanel inspection={latestInspection} />
                <RuntimePanel inspection={latestInspection} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
