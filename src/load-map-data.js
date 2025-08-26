export default async function loadMapData(mapName) {
  const resolvedName =
    mapName ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  const jsonPath = `./src/data/${resolvedName}.json`;
  try {
    if (typeof fetch === "function") {
      try {
        const res = await fetch(jsonPath);
        if (res.ok) return await res.json();
      } catch {}
    }
    const fs = await import("fs/promises");
    const pathMod = await import("path");
    const filePath = pathMod.resolve(`src/data/${resolvedName}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    throw new Error(`Unable to load map data: ${err.message}`);
  }
}
