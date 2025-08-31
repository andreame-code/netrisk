/* eslint-env jest */
global.fetch = jest.fn(async () => {
  throw new Error("Network requests are disabled in tests");
});
