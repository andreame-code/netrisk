export const levelCamera = {
  map3: { deadZoneWidthPct: 0.5, deadZoneHeightPct: 0.5, cameraLerp: 0.1 },
};

export function getLevelCamera(levelId) {
  return (
    levelCamera[levelId] || {
      deadZoneWidthPct: 1,
      deadZoneHeightPct: 1,
      cameraLerp: 1,
    }
  );
}
