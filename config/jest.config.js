const path = require("path");

module.exports = {
  rootDir: path.resolve(__dirname, ".."),
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.[jt]s"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.js"],
  transform: {
    "^.+\\.[tj]s$": [
      "babel-jest",
      { configFile: path.resolve(__dirname, "babel.config.js") },
    ],
  },
};
