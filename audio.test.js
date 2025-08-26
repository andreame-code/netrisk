import {
  playEffect,
  setMasterVolume,
  getMasterVolume,
  setEffectsVolume,
  getEffectsVolume,
  setMuted,
  isMuted,
  setMusicEnabled,
  isMusicEnabled,
} from "./audio.js";

describe("audio helpers", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  test("playEffect is safe when Audio is undefined", () => {
    const original = global.Audio;
    // eslint-disable-next-line no-undefined
    global.Audio = undefined;
    expect(() => playEffect("reinforce")).not.toThrow();
    global.Audio = original;
  });

  test("volume setters clamp between 0 and 1", () => {
    setMasterVolume(2);
    expect(getMasterVolume()).toBe(1);
    setMasterVolume(-1);
    expect(getMasterVolume()).toBe(0);
    setEffectsVolume(2);
    expect(getEffectsVolume()).toBe(1);
    setEffectsVolume(-1);
    expect(getEffectsVolume()).toBe(0);
  });

  test("mute and music toggles", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
    setMusicEnabled(false);
    expect(isMusicEnabled()).toBe(false);
    setMusicEnabled(true);
    expect(isMusicEnabled()).toBe(true);
  });

  test("settings persist via localStorage", () => {
    setMasterVolume(0.33);
    setMuted(true);
    const stored = localStorage.getItem("audioSettings");
    expect(stored).toContain('"master":0.33');
    expect(stored).toContain('"muted":true');
    jest.resetModules();
    const reloaded = require("./audio.js");
    expect(reloaded.getMasterVolume()).toBeCloseTo(0.33);
    expect(reloaded.isMuted()).toBe(true);
  });
});

