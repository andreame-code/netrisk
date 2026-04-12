// @ts-nocheck
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..", "..");

const TOKEN_LITERAL_PATTERN = /#[0-9A-Fa-f]{3,8}\b|rgba?\(/;
const TOKEN_SECTION_START = "/* Theme token definitions start */";
const TOKEN_SECTION_END = "/* Theme token definitions end */";

function checkThemeTokenization() {
  const publicDir = path.join(projectRoot, "frontend", "public");
  const cssFiles = fs.readdirSync(publicDir).filter((fileName) => fileName.endsWith(".css"));
  const violations = [];

  cssFiles.forEach((fileName) => {
    const absolutePath = path.join(publicDir, fileName);
    const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
    let inTokenSection = false;

    lines.forEach((line, index) => {
      if (line.includes(TOKEN_SECTION_START)) {
        inTokenSection = true;
      }

      if (!inTokenSection && TOKEN_LITERAL_PATTERN.test(line)) {
        violations.push(`${path.relative(path.join(__dirname, ".."), absolutePath)}:${index + 1}: ${line.trim()}`);
      }

      if (line.includes(TOKEN_SECTION_END)) {
        inTokenSection = false;
      }
    });
  });

  if (violations.length > 0) {
    const error = new Error(
      "Trovati colori hardcoded fuori dalla sezione token temi:\n" + violations.join("\n")
    );
    error.violations = violations;
    throw error;
  }
}

if (require.main === module) {
  try {
    checkThemeTokenization();
    console.log("Theme tokenization check passed.");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  checkThemeTokenization
};
