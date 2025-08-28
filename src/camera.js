function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function updateCamera(player, camera, level, viewport, opts) {
  const { deadZoneWidthPct, deadZoneHeightPct, cameraLerp } = opts;
  const dzWidth = viewport.width * deadZoneWidthPct;
  const dzHeight = viewport.height * deadZoneHeightPct;
  const offsetX = (viewport.width - dzWidth) / 2;
  const offsetY = (viewport.height - dzHeight) / 2;

  let targetX = camera.x;
  let targetY = camera.y;

  const dzLeft = camera.x + offsetX;
  const dzRight = dzLeft + dzWidth;
  const dzTop = camera.y + offsetY;
  const dzBottom = dzTop + dzHeight;

  if (player.x < dzLeft) targetX = player.x - offsetX;
  else if (player.x > dzRight) targetX = player.x - offsetX - dzWidth;

  if (player.y < dzTop) targetY = player.y - offsetY;
  else if (player.y > dzBottom) targetY = player.y - offsetY - dzHeight;

  const maxX = Math.max(0, level.width - viewport.width);
  const maxY = Math.max(0, level.height - viewport.height);
  targetX = Math.min(Math.max(0, targetX), maxX);
  targetY = Math.min(Math.max(0, targetY), maxY);

  return {
    x: lerp(camera.x, targetX, cameraLerp),
    y: lerp(camera.y, targetY, cameraLerp),
  };
}

export function getParallaxOffset(camera, factor) {
  return { x: -camera.x * factor, y: -camera.y * factor };
}

export default { updateCamera, getParallaxOffset };
