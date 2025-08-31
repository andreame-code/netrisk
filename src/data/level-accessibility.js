export const levelAccessibility = {
  map: { highContrast: false, jumpAssist: false },
  map2: { highContrast: false, jumpAssist: false },
  map3: { highContrast: true, jumpAssist: true },
  "map-roman": { highContrast: false, jumpAssist: false },
};

export function getLevelAccessibility(levelId) {
  return (
    levelAccessibility[levelId] || {
      highContrast: false,
      jumpAssist: false,
    }
  );
}

export function applyLevelAccessibility(levelId, doc = document) {
  const opts = getLevelAccessibility(levelId);
  const body = doc && doc.body;
  if (!body) return opts;
  if (opts.highContrast) body.classList.add("high-contrast");
  if (opts.jumpAssist) body.classList.add("jump-assist");
  return opts;
}
