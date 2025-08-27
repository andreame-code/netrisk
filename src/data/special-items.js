export const levelItems = {
  map: { starDust: 0, crystalKey: false, rainbowPortal: false },
  map2: { starDust: 0, crystalKey: false, rainbowPortal: false },
  map3: { starDust: 30, crystalKey: true, rainbowPortal: true },
  "map-roman": { starDust: 0, crystalKey: false, rainbowPortal: false },
};

export function getLevelItems(levelId) {
  return levelItems[levelId] || { starDust: 0, crystalKey: false, rainbowPortal: false };
}
