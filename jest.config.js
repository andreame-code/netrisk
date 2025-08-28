module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.[jt]s'],
  transform: {
    '^.+\\.[tj]s$': 'babel-jest'
  }
};
