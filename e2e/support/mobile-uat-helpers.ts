const { expect } = require("@playwright/test");

const mobileProfiles = {
  "mobile-chromium-360": { width: 360, height: 780, browser: "chromium" },
  "mobile-chromium-390": { width: 390, height: 844, browser: "chromium" },
  "mobile-chromium-430": { width: 430, height: 932, browser: "chromium" },
  "mobile-chromium-landscape": { width: 844, height: 390, browser: "chromium" },
  "mobile-webkit-390": { width: 390, height: 844, browser: "webkit" }
};

function mobileProfile(projectName) {
  const profile = mobileProfiles[projectName];
  if (!profile) {
    throw new Error(`Unsupported mobile UAT project: ${projectName}`);
  }
  return profile;
}

function isCriticalMobileProject(projectName) {
  return projectName === "mobile-chromium-390" || projectName === "mobile-webkit-390";
}

async function expectTouchTarget(locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function expectInsideViewport(page, locator) {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectKeyboardFocusRemainsUsable(page, locator) {
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("Mobile viewport is unavailable.");
  }

  const reducedHeight = Math.max(320, viewport.height - 240);
  await page.setViewportSize({ width: viewport.width, height: reducedHeight });
  await locator.focus();
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeFocused();
  await expectInsideViewport(page, locator);
  await page.setViewportSize(viewport);
}

function touchPoint(id, x, y) {
  return {
    id,
    x,
    y,
    radiusX: 8,
    radiusY: 8,
    force: 1
  };
}

async function withCdpSession(page, callback) {
  const session = await page.context().newCDPSession(page);
  try {
    await callback(session);
  } finally {
    await session.detach();
  }
}

async function nativeOneFingerPan(page, locator, deltaX, deltaY) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Map surface bounds are unavailable for touch pan.");
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await withCdpSession(page, async (session) => {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [touchPoint(1, startX, startY)]
    });
    for (let step = 1; step <= 6; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [touchPoint(1, startX + (deltaX * step) / 6, startY + (deltaY * step) / 6)]
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  });
}

async function nativeTwoFingerPinch(page, locator, startHalfDistance, endHalfDistance) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Map surface bounds are unavailable for touch pinch.");
  }
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await withCdpSession(page, async (session) => {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        touchPoint(1, centerX - startHalfDistance, centerY),
        touchPoint(2, centerX + startHalfDistance, centerY)
      ]
    });
    for (let step = 1; step <= 8; step += 1) {
      const halfDistance = startHalfDistance + ((endHalfDistance - startHalfDistance) * step) / 8;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          touchPoint(1, centerX - halfDistance, centerY),
          touchPoint(2, centerX + halfDistance, centerY)
        ]
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  });
}

async function revealMobileControl(page, locator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await locator.isVisible()) {
      return;
    }
    const toggle = page.locator(".game-command-dock-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();
  }
  await expect(locator).toBeVisible();
}

module.exports = {
  expectInsideViewport,
  expectKeyboardFocusRemainsUsable,
  expectTouchTarget,
  isCriticalMobileProject,
  mobileProfile,
  nativeOneFingerPan,
  nativeTwoFingerPinch,
  revealMobileControl
};
