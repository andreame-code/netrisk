const crypto = require("crypto");

function secureRandom(): number {
  return crypto.randomInt(0x100000000) / 0x100000000;
}

function randomHex(bytes: number = 4): string {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = {
  randomHex,
  secureRandom
};
