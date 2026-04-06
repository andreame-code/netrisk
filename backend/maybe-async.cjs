function isPromiseLike(value) {
  return Boolean(value) && typeof value.then === "function";
}

function mapMaybe(value, mapper) {
  if (isPromiseLike(value)) {
    return value.then(mapper);
  }

  return mapper(value);
}

function chainMaybe(value, mapper) {
  if (isPromiseLike(value)) {
    return value.then((resolved) => mapper(resolved));
  }

  return mapper(value);
}

module.exports = {
  chainMaybe,
  isPromiseLike,
  mapMaybe
};
