type CatalogCarrier = {
  resolvedCatalog?: unknown;
};

function resolvedCatalogFromCarrier<T extends Record<string, unknown>>(
  carrier: CatalogCarrier | null | undefined
): T {
  const resolved = carrier && typeof carrier === "object" ? (carrier as any).resolvedCatalog : null;
  if (resolved && typeof resolved === "object") {
    return resolved as T;
  }

  if (carrier && typeof carrier === "object") {
    return carrier as unknown as T;
  }

  return {} as T;
}

function listEntries<T>(entries: T[] | null | undefined): T[] {
  return Array.isArray(entries) ? entries : [];
}

function listFromCatalog<T extends Record<string, unknown>, K extends keyof T>(
  catalog: T,
  key: K
): Array<any> {
  const entries = catalog[key];
  return Array.isArray(entries) ? (entries as any[]) : [];
}

function findCatalogEntry<T extends Record<string, unknown>, K extends keyof T>(
  catalog: T,
  key: K,
  id: string
) {
  return listFromCatalog(catalog, key).find((entry) => entry && entry.id === id) || null;
}

module.exports = {
  resolvedCatalogFromCarrier,
  listEntries,
  listFromCatalog,
  findCatalogEntry
};
