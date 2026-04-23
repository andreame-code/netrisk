const assert = require("node:assert/strict");

const {
  AUTHORED_MODULES_STATE_KEY,
  createAuthoredModulesService
} = require("../../../backend/authored-modules.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function createMemoryDatastore(initialState?: unknown) {
  let state = clone(initialState);
  return {
    getAppState(key: string) {
      assert.equal(key, AUTHORED_MODULES_STATE_KEY);
      return clone(state);
    },
    setAppState(key: string, value: unknown) {
      assert.equal(key, AUTHORED_MODULES_STATE_KEY);
      state = clone(value);
    },
    readState() {
      return clone(state);
    }
  };
}

function createVictoryDraft(
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    version: string;
    mapId: string;
    objectives: unknown[];
  }> = {}
) {
  return {
    id: overrides.id || "victory.world.na-asia",
    name: overrides.name || "North America and Asia",
    description:
      overrides.description ||
      "Author a world-classic objective that spans two strategic continents.",
    version: overrides.version || "1.0.0",
    moduleType: "victory-objectives",
    content: {
      mapId: overrides.mapId || "world-classic",
      objectives: overrides.objectives || [
        {
          id: "hold-na-asia",
          title: "Hold North America and Asia",
          description: "Control North America and Asia at the same time.",
          enabled: true,
          type: "control-continents",
          continentIds: ["north_america", "asia"]
        }
      ]
    }
  };
}

function toStoredModule(
  input: ReturnType<typeof createVictoryDraft>,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...clone(input),
    status: "draft",
    createdAt: "2026-04-20T10:00:00.000Z",
    updatedAt: "2026-04-20T10:00:00.000Z",
    ...overrides
  };
}

register("authored modules service filters stored modules and exposes editor options", async () => {
  const datastore = createMemoryDatastore({
    modules: [
      { id: "" },
      toStoredModule(createVictoryDraft({ id: "victory.older", name: "Older Module" }), {
        updatedAt: "2026-04-20T10:00:00.000Z"
      }),
      toStoredModule(
        createVictoryDraft({
          id: "victory.newer",
          name: "Newer Module",
          objectives: [
            {
              id: "hold-twelve",
              title: "Own twelve territories",
              description: "Reach twelve territories on the world map.",
              enabled: true,
              type: "control-territory-count",
              territoryCount: 12
            }
          ]
        }),
        {
          status: "published",
          updatedAt: "2026-04-21T10:00:00.000Z"
        }
      )
    ]
  });
  const service = createAuthoredModulesService({ datastore });

  const options = await service.listEditorOptions();
  assert.deepEqual(options.moduleTypes, ["victory-objectives"]);
  assert.equal(
    options.maps.some((entry: { id?: string }) => entry.id === "world-classic"),
    true
  );

  const modules = await service.listModules();
  assert.deepEqual(
    modules.map((entry: { id: string }) => entry.id),
    ["victory.newer", "victory.older"]
  );
  assert.equal(modules[0].map?.id, "world-classic");

  const detail = await service.getModule("victory.older");
  assert.equal(detail.module.id, "victory.older");
  assert.equal(detail.validation.valid, true);
  assert.match(detail.preview.summary, /North America and Asia/i);

  assert.equal(await service.isModuleStored("victory.newer"), true);
  assert.equal(await service.isModuleStored("missing-module"), false);
});

register(
  "authored modules service validates drafts and manages the publish lifecycle",
  async () => {
    const datastore = createMemoryDatastore();
    const service = createAuthoredModulesService({ datastore });

    const builtInIdValidation = await service.validateDraft(createVictoryDraft({ id: "conquest" }));
    assert.equal(builtInIdValidation.validation.valid, false);
    assert.equal(
      builtInIdValidation.validation.errors.some(
        (entry: { code?: string }) => entry.code === "reserved-module-id"
      ),
      true
    );

    const invalidValidation = await service.validateDraft(
      createVictoryDraft({
        id: "victory.invalid-validation",
        objectives: [
          {
            id: "duplicate-objective",
            title: "Broken continent objective",
            description: "Select the same and an invalid continent.",
            enabled: true,
            type: "control-continents",
            continentIds: ["north_america", "north_america", "atlantis"]
          },
          {
            id: "duplicate-objective",
            title: "Broken territory objective",
            description: "Set an impossible territory count.",
            enabled: true,
            type: "control-territory-count",
            territoryCount: 0
          }
        ]
      })
    );
    const invalidCodes = invalidValidation.validation.errors.map(
      (entry: { code: string }) => entry.code
    );
    assert.equal(invalidValidation.validation.valid, false);
    assert.equal(invalidCodes.includes("duplicate-objective-id"), true);
    assert.equal(invalidCodes.includes("duplicate-continent-id"), true);
    assert.equal(invalidCodes.includes("invalid-continent-id"), true);
    assert.equal(invalidCodes.includes("invalid-territory-count"), true);

    const savedDraft = await service.saveDraft(createVictoryDraft({ id: "victory.lifecycle" }));
    assert.equal(savedDraft.module.status, "draft");

    const published = await service.publishModule("victory.lifecycle");
    assert.equal(published.module.status, "published");

    const publishedRuleSets = await service.listPublishedVictoryRuleSets();
    const publishedRule = publishedRuleSets.find(
      (entry: { id: string }) => entry.id === "victory.lifecycle"
    );
    assert.ok(publishedRule);
    assert.equal(publishedRule.source, "authored");
    assert.equal(publishedRule.objectiveCount, 1);

    const disabled = await service.disableModule("victory.lifecycle");
    assert.equal(disabled.module.status, "disabled");
    assert.equal(await service.findPublishedVictoryRuleSetRuntime("victory.lifecycle"), null);

    const enabled = await service.enableModule("victory.lifecycle");
    assert.equal(enabled.module.status, "published");
    assert.equal(
      (await service.findPublishedVictoryRuleSetRuntime("victory.lifecycle"))?.id,
      "victory.lifecycle"
    );
  }
);

register("authored modules service blocks published edits and invalid re-enabling", async () => {
  const datastore = createMemoryDatastore();
  const service = createAuthoredModulesService({ datastore });
  const draft = createVictoryDraft({ id: "victory.map-bound" });

  await service.saveDraft(draft);
  await service.publishModule(draft.id);

  await assert.rejects(
    () =>
      service.saveDraft(
        createVictoryDraft({
          id: draft.id,
          description: "Attempt to revise a published module in place."
        })
      ),
    /Only draft modules are editable/i
  );

  await service.disableModule(draft.id);
  service.setMapCatalog({
    listMaps: () => [],
    resolveMap: () => null
  });

  await assert.rejects(
    () => service.enableModule(draft.id),
    (error: any) => {
      assert.equal(error.statusCode, 400);
      assert.equal(
        error.validation.errors.some((entry: { code?: string }) => entry.code === "invalid-map"),
        true
      );
      return true;
    }
  );
});
