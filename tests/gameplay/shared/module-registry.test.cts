const assert = require("node:assert/strict");
const { createModuleRegistry } = require("../../../shared/module-registry.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("shared module registry resolves entries and fallback ids", () => {
  const registry = createModuleRegistry([
    { id: "standard", name: "Standard" },
    { id: "variant", name: "Variant" }
  ]);

  assert.equal(registry.find("variant")?.name, "Variant");
  assert.equal(registry.find(null), null);
  assert.equal(registry.get(null, "standard").id, "standard");
  assert.equal(registry.get("variant", "standard").id, "variant");
});

register("shared module registry rejects invalid and duplicate ids", () => {
  assert.throws(() => createModuleRegistry([{ id: "", name: "Missing" }]), /valid id/);
  assert.throws(
    () =>
      createModuleRegistry([
        { id: "duplicate", name: "First" },
        { id: "duplicate", name: "Second" }
      ]),
    /Duplicate registry entry/
  );
});

register("shared module registry freezes entries and delegates missing lookup handling", () => {
  const registry = createModuleRegistry([{ id: "standard", name: "Standard" }], {
    onMissing(id: string): never {
      throw new Error(`Missing registry entry: ${id}`);
    }
  });

  assert.equal(Object.isFrozen(registry.entries), true);
  assert.equal(Object.isFrozen(registry.entries[0]), true);
  assert.throws(() => registry.get("ghost", "standard"), /Missing registry entry: ghost/);
});
