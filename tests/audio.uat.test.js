describe('audio user acceptance', () => {
  let audio;
  let playMock;
  let audioObj;
  let store;

  beforeEach(() => {
    jest.resetModules();
    store = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((k) => store[k]),
        setItem: jest.fn((k, v) => {
          store[k] = v;
        }),
      },
      configurable: true,
    });
    playMock = jest.fn().mockResolvedValue();
    audioObj = {
      play: playMock,
      pause: jest.fn(),
      addEventListener: jest.fn(),
      currentTime: 0,
      _volume: 1,
      set volume(v) {
        this._volume = v;
      },
      get volume() {
        return this._volume;
      },
      muted: false,
    };
    global.Audio = jest.fn(() => audioObj);
    // eslint-disable-next-line global-require
    audio = require('../src/audio.js');
  });

  test('persists volume and mute settings', () => {
    audio.setMasterVolume(0.7);
    audio.setEffectsVolume(0.6);
    audio.setMuted(true);
    const saved = JSON.parse(
      global.localStorage.setItem.mock.calls[
        global.localStorage.setItem.mock.calls.length - 1
      ][1]
    );
    expect(saved.master).toBe(0.7);
    expect(saved.effects).toBe(0.6);
    expect(saved.muted).toBe(true);
    expect(audio.getMasterVolume()).toBe(0.7);
    expect(audio.getEffectsVolume()).toBe(0.6);
    expect(audio.isMuted()).toBe(true);
  });

  test('playEffect respects volume and mute', () => {
    audio.setMuted(false);
    audio.setMasterVolume(0.8);
    audio.setEffectsVolume(0.5);
    audio.playEffect('reinforce');
    expect(playMock).toHaveBeenCalled();
    expect(audioObj._volume).toBeCloseTo(0.4);

    playMock.mockClear();
    audio.setMuted(true);
    audio.playEffect('reinforce');
    expect(playMock).not.toHaveBeenCalled();
  });

  test('handles missing audio files gracefully', () => {
    jest.resetModules();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((k) => storage[k]),
        setItem: jest.fn((k, v) => {
          storage[k] = v;
        }),
      },
      configurable: true,
    });
    const errAudio = {
      play: jest.fn(),
      pause: jest.fn(),
      currentTime: 0,
      _volume: 1,
      set volume(v) {
        this._volume = v;
      },
      get volume() {
        return this._volume;
      },
      muted: false,
      addEventListener: (event, handler) => {
        if (event === 'error') handler();
      },
    };
    global.Audio = jest.fn(() => errAudio);
    // eslint-disable-next-line global-require
    const mod = require('../src/audio.js');
    mod.loadAudio('missing.mp3');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing.mp3'));
    expect(mod.loadAudio('missing.mp3')).toBeNull();
    warn.mockRestore();
  });
});

