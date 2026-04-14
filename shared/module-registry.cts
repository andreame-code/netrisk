export interface RegistryEntry {
  id: string;
  name: string;
}

export interface ModuleRegistry<TEntry extends RegistryEntry> {
  entries: ReadonlyArray<Readonly<TEntry>>;
  find(id: string | null | undefined): Readonly<TEntry> | null;
  get(id: string | null | undefined, fallbackId: string): Readonly<TEntry>;
}

export function createModuleRegistry<TEntry extends RegistryEntry>(
  entries: readonly TEntry[],
  options: {
    onMissing?: (id: string) => never;
  } = {}
): ModuleRegistry<TEntry> {
  const entriesById = entries.reduce<Record<string, Readonly<TEntry>>>((accumulator, entry) => {
    if (!entry?.id) {
      throw new Error("Registry entries require a valid id.");
    }

    if (accumulator[entry.id]) {
      throw new Error(`Duplicate registry entry "${entry.id}".`);
    }

    accumulator[entry.id] = Object.freeze({ ...entry });
    return accumulator;
  }, {});

  const frozenEntries = Object.freeze(Object.values(entriesById));

  return Object.freeze({
    entries: frozenEntries,
    find(id: string | null | undefined): Readonly<TEntry> | null {
      if (!id) {
        return null;
      }

      return entriesById[id] || null;
    },
    get(id: string | null | undefined, fallbackId: string): Readonly<TEntry> {
      const resolvedId = id || fallbackId;
      const entry = entriesById[resolvedId];
      if (entry) {
        return entry;
      }

      if (typeof options.onMissing === "function") {
        return options.onMissing(resolvedId);
      }

      throw new Error(`Registry entry "${resolvedId}" not found.`);
    }
  });
}
