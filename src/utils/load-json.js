export default async function loadJson(path) {
  try {
    if (typeof fetch === 'function') {
      const res = await fetch(path);
      if (res.ok) {
        return await res.json();
      }
    }
  } catch {
    // Ignore fetch errors and fall back to fs
  }
  const fs = await import('node:fs/promises');
  const pathMod = await import('node:path');
  const filePath = pathMod.resolve(path.startsWith('./') ? path.slice(2) : path);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}
