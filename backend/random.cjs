const crypto = require("crypto");

function secureRandom() {
  return crypto.randomInt(0x100000000) / 0x100000000;
}

function randomHex(bytes = 4) {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = {
  randomHex,
  secureRandom
};
