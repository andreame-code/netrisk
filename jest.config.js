module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.js'],
  transform: {
    '^.+\\.[tj]s$': 'babel-jest'
  }
};
