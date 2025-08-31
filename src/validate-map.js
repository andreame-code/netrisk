const Ajv = require("ajv");
const schema = require("./data/map-schema.json");
delete schema.$schema;

const ajv = new Ajv();
const validate = ajv.compile(schema);

function validateMap(data) {
  const valid = validate(data);
  if (!valid) {
    const err = new Error("Invalid map data");
    err.errors = validate.errors;
    throw err;
  }
  return true;
}

module.exports = validateMap;
