export const levelHud = {
  map: { starDust: false, crystalKey: false, powerUps: false },
  map2: { starDust: false, crystalKey: false, powerUps: false },
  map3: { starDust: true, crystalKey: true, powerUps: true },
  "map-roman": { starDust: false, crystalKey: false, powerUps: false },
};

export function getHudElements(levelId) {
  return (
    levelHud[levelId] || {
      starDust: false,
      crystalKey: false,
      powerUps: false,
    }
  );
}
