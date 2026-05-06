const assert = require("node:assert/strict");

const {
  MODULE_VERSION_BUMP_RULES,
  checkModuleCompatibility,
  findModuleVersionChangeRequirements,
  functionalModuleVersions,
  getFunctionalModuleVersion,
  isModuleCompatibleWith,
  isValidModuleSemver,
  isValidVersionRange,
  listFunctionalModuleVersions,
  moduleCompatibility,
  moduleVersionManifest,
  validateModuleVersionManifest,
  versionSatisfiesRange
} = require("../../../shared/module-versions.cjs");
const { validateNetRiskModuleManifest } = require("../../../shared/netrisk-modules.cjs");
const {
  parseChangedFilePathsFromNameStatus
} = require("../../../scripts/check-module-versioning.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

register("module version manifest centrally lists current functional modules", () => {
  assert.equal(moduleVersionManifest.schemaVersion, 1);
  assert.deepEqual(validateModuleVersionManifest(), []);

  const moduleIds = listFunctionalModuleVersions().map((entry: { id: string }) => entry.id);
  assert.equal(moduleIds.includes("core.base"), true);
  assert.equal(moduleIds.includes("maps"), true);
  assert.equal(moduleIds.includes("victory-rule-sets"), true);
  assert.equal(moduleIds.includes("module-runtime"), true);
  assert.equal(moduleIds.includes("authored-victory-objectives"), true);
  assert.equal(moduleIds.includes("datastore"), true);
  assert.equal(moduleIds.includes("public-state"), true);

  assert.equal(getFunctionalModuleVersion("maps")?.version, "1.0.0");
  assert.equal(Boolean(MODULE_VERSION_BUMP_RULES.patch), true);
  assert.equal(Boolean(MODULE_VERSION_BUMP_RULES.minor), true);
  assert.equal(Boolean(MODULE_VERSION_BUMP_RULES.major), true);
});

register("module version manifest validation rejects malformed data", () => {
  const modules = clone(functionalModuleVersions);
  const compatibility = clone(moduleCompatibility);

  modules[0].version = "1.0";
  compatibility[1].requires.push({ moduleId: "missing.module", versions: "1.x" });
  compatibility[2].moduleVersions = ">=2.0.0 <1.0.0";
  compatibility[3].compatibleSaveGameSchemaVersions = { min: 2, max: 1 };

  const errors = validateModuleVersionManifest(modules, compatibility);

  assert.equal(
    errors.some((entry: string) => entry.includes("invalid SemVer")),
    true
  );
  assert.equal(
    errors.some((entry: string) => entry.includes("requires unknown module")),
    true
  );
  assert.equal(
    errors.some((entry: string) => entry.includes("invalid module version range")),
    true
  );
  assert.equal(
    errors.some((entry: string) => entry.includes("invalid save-game schema range")),
    true
  );
});

register("module version range helpers support exact, wildcard, and comparator ranges", () => {
  assert.equal(isValidModuleSemver("1.2.3"), true);
  assert.equal(isValidModuleSemver("1.2.03"), false);
  assert.equal(isValidModuleSemver("1.2"), false);

  assert.equal(isValidVersionRange("1.x"), true);
  assert.equal(isValidVersionRange("1.2.x"), true);
  assert.equal(isValidVersionRange(">=1.0.0 <2.0.0"), true);
  assert.equal(isValidVersionRange(">=1.0.0 <=1.0.0"), true);
  assert.equal(isValidVersionRange(">=2.0.0 <1.0.0"), false);
  assert.equal(isValidVersionRange(">1.0.0 <1.0.0"), false);
  assert.equal(isValidVersionRange(">1.0.0 <=1.0.0"), false);
  assert.equal(isValidVersionRange(">=1.0.0 <1.0.0"), false);
  assert.equal(isValidVersionRange("not-a-range"), false);

  assert.equal(versionSatisfiesRange("1.4.2", "1.x"), true);
  assert.equal(versionSatisfiesRange("2.0.0", "1.x"), false);
  assert.equal(versionSatisfiesRange("1.4.2", ">=1.0.0 <2.0.0"), true);
  assert.equal(versionSatisfiesRange("2.0.0", ">=1.0.0 <2.0.0"), false);
  assert.equal(versionSatisfiesRange("0.1.005", "0.1.x", { allowPaddedPatch: true }), true);
});

register("runtime module manifest validation rejects invalid versions and ranges", () => {
  const manifest = {
    schemaVersion: 1,
    id: "demo.invalid-version",
    version: "1.0.0",
    displayName: "Invalid Version Demo",
    engineVersion: "1.0.0",
    moduleApiVersion: "1.0.0",
    minimumCompatibleSaveGameSchemaVersion: 1,
    maximumCompatibleSaveGameSchemaVersion: 1,
    kind: "hybrid",
    dependencies: [{ id: "core.base", version: "1.x" }],
    conflicts: [],
    capabilities: [{ kind: "ui-slot", scope: "global" }]
  };

  assert.equal(validateNetRiskModuleManifest(manifest, "module.json").version, manifest.version);

  assert.throws(
    () =>
      validateNetRiskModuleManifest(
        {
          ...manifest,
          version: "1.0"
        },
        "module.json"
      ),
    /invalid SemVer/
  );

  assert.throws(
    () =>
      validateNetRiskModuleManifest(
        {
          ...manifest,
          dependencies: [{ id: "core.base", version: ">=2.0.0 <1.0.0" }]
        },
        "module.json"
      ),
    /Invalid module dependency version range/
  );
});

register("module compatibility checks app, schema, API, and dependent module versions", () => {
  const compatible = checkModuleCompatibility("module-runtime", "1.0.0", {
    modules: {
      "core.base": "1.0.0"
    }
  });
  assert.deepEqual(compatible, {
    compatible: true,
    errors: []
  });

  const missingDependency = checkModuleCompatibility("module-runtime", "1.0.0");
  assert.equal(missingDependency.compatible, false);
  assert.equal(
    missingDependency.errors.some((entry: string) => entry.includes("requires core.base")),
    true
  );

  const wrongDependency = checkModuleCompatibility("module-runtime", "1.0.0", {
    modules: {
      "core.base": "2.0.0"
    }
  });
  assert.equal(wrongDependency.compatible, false);
  assert.equal(
    wrongDependency.errors.some((entry: string) => entry.includes("received 2.0.0")),
    true
  );

  const wrongApp = checkModuleCompatibility("maps", "1.0.0", {
    appVersion: "0.2.000"
  });
  assert.equal(wrongApp.compatible, false);
  assert.equal(
    wrongApp.errors.some((entry: string) => entry.includes("app version")),
    true
  );

  const wrongSchema = checkModuleCompatibility("maps", "1.0.0", {
    saveGameSchemaVersion: 2
  });
  assert.equal(wrongSchema.compatible, false);
  assert.equal(
    wrongSchema.errors.some((entry: string) => entry.includes("save-game schema")),
    true
  );

  assert.equal(isModuleCompatibleWith("demo.command-center", "1.0.0", "core.base", "1.0.0"), true);
  assert.equal(isModuleCompatibleWith("demo.command-center", "1.0.0", "core.base", "2.0.0"), false);
  assert.equal(isModuleCompatibleWith("setup-flow", "1.0.0", "content-packs", "1.0.0"), true);
  assert.equal(isModuleCompatibleWith("setup-flow", "1.0.0", "content-packs", "2.0.0"), false);
  assert.equal(
    isModuleCompatibleWith("setup-flow", "1.0.0", "content-packs", "1.0.0", {
      appVersion: "0.2.000"
    }),
    false
  );
});

register("module version bump detector maps changed paths to owned functional modules", () => {
  const requirements = findModuleVersionChangeRequirements(
    [
      "shared/maps/world-classic.cts",
      "backend/engine/victory-detection.cts",
      "docs/versioning-policy.md"
    ],
    ["maps"]
  );

  const mapsRequirement = requirements.find(
    (entry: { moduleId: string }) => entry.moduleId === "maps"
  );
  const victoryRequirement = requirements.find(
    (entry: { moduleId: string }) => entry.moduleId === "victory-rule-sets"
  );

  assert.ok(mapsRequirement);
  assert.equal(mapsRequirement.versionChanged, true);
  assert.deepEqual(mapsRequirement.changedPaths, ["shared/maps/world-classic.cts"]);

  assert.ok(victoryRequirement);
  assert.equal(victoryRequirement.versionChanged, false);
  assert.deepEqual(victoryRequirement.changedPaths, ["backend/engine/victory-detection.cts"]);
});

register("module version bump detector includes both paths from git rename output", () => {
  const changedPaths = parseChangedFilePathsFromNameStatus(
    [
      "M\tshared/module-versions.cts",
      "R100\tshared/maps/world-classic.cts\tdocs/world-classic-map.md",
      "C075\tshared/dice.cts\tshared/dice-copy.cts"
    ].join("\n")
  );

  assert.deepEqual(changedPaths, [
    "shared/module-versions.cts",
    "shared/maps/world-classic.cts",
    "docs/world-classic-map.md",
    "shared/dice.cts",
    "shared/dice-copy.cts"
  ]);

  const requirements = findModuleVersionChangeRequirements(changedPaths, []);
  assert.equal(
    requirements.some(
      (entry: { moduleId: string; changedPaths: string[] }) =>
        entry.moduleId === "maps" && entry.changedPaths.includes("shared/maps/world-classic.cts")
    ),
    true
  );
});
