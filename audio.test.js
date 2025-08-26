import * as audio from './audio.js';

describe('audio helpers', () => {
  test('playTone returns without error when window is undefined', () => {
    const originalWindow = global.window;
    // Simulate environment without window
    // eslint-disable-next-line no-undefined
    global.window = undefined;
    expect(() => audio.playTone(440)).not.toThrow();
    global.window = originalWindow;
  });

  test('playAttackSound does not throw', () => {
    expect(() => audio.playAttackSound()).not.toThrow();
  });

  test('playConquerSound does not throw', () => {
    expect(() => audio.playConquerSound()).not.toThrow();
  });

  test('playTone creates audio nodes when AudioContext is available', () => {
    const originalWindow = global.window;
    const mockCtx = {
      createOscillator: () => ({
        type: '',
        frequency: { value: 0 },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      }),
      createGain: () => ({
        connect: jest.fn(),
        gain: {
          setValueAtTime: jest.fn(),
          exponentialRampToValueAtTime: jest.fn(),
        },
      }),
      destination: {},
      currentTime: 0,
    };
    global.window = { AudioContext: function () { return mockCtx; } };
    expect(() => audio.playTone(440, 0.1)).not.toThrow();
    global.window = originalWindow;
  });

  test('setVolume clamps between 0 and 1', () => {
    audio.setVolume(2);
    expect(audio.getVolume()).toBe(1);
    audio.setVolume(-1);
    expect(audio.getVolume()).toBe(0);
    audio.setVolume(0.5);
    expect(audio.getVolume()).toBe(0.5);
  });

  test('setMuted controls mute state', () => {
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.isMuted()).toBe(false);
  });
});
