/** @jest-environment node */

describe('getSafeReferrer', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('returns URL when referrer has same origin', () => {
    global.window = {
      location: {
        href: 'https://example.com/current',
        origin: 'https://example.com',
      },
    };
    global.document = { referrer: 'https://example.com/previous' };
    const { getSafeReferrer } = require('../src/utils/referrer.js');

    expect(getSafeReferrer()).toBe('https://example.com/previous');
  });

  test('returns null when referrer has different origin', () => {
    global.window = {
      location: {
        href: 'https://example.com/current',
        origin: 'https://example.com',
      },
    };
    global.document = { referrer: 'https://evil.com/attack' };
    const { getSafeReferrer } = require('../src/utils/referrer.js');

    expect(getSafeReferrer()).toBeNull();
  });
});
