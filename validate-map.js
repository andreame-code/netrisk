const Ajv = require('ajv/dist/2020').default;
const schema = require('./src/data/map-schema.json');

const ajv = new Ajv();
const validate = ajv.compile(schema);

function validateMap(data) {
  const valid = validate(data);
  if (!valid) {
    const err = new Error('Invalid map data');
    err.errors = validate.errors;
    throw err;
  }
  return true;
}

module.exports = validateMap;
