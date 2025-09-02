/**
 * @jest-environment node
 */
const { hashContent } = require('../src/build');

describe('hashContent', () => {
  test('produces consistent hash for same content', () => {
    const content = 'hello world';
    const expected = 'b94d27b9';
    expect(hashContent(content)).toBe(expected);
    expect(hashContent(content)).toBe(expected);
  });

  test('produces different hashes for different content', () => {
    const a = hashContent('foo');
    const b = hashContent('bar');
    expect(a).not.toBe(b);
  });

  test('handles empty content', () => {
    expect(hashContent('')).toBe('e3b0c442');
  });
});
