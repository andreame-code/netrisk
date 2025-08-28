const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.[jt]s'],
  transform: {
    '^.+\\.[tj]s$': ['babel-jest', { configFile: path.resolve(__dirname, 'babel.config.js') }]
  }
};
