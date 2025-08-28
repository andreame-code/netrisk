const DEFAULT_ITEMS = { starDust: 0, crystalKey: false, rainbowPortal: false };

export const levelItems = {
  map: { ...DEFAULT_ITEMS },
  map2: { ...DEFAULT_ITEMS },
  map3: { starDust: 30, crystalKey: true, rainbowPortal: true },
  "map-roman": { ...DEFAULT_ITEMS },
};

export function getLevelItems(levelId) {
  return levelItems[levelId] || { ...DEFAULT_ITEMS };
}
