function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === "function";
}

function mapMaybe<T, U>(value: T | Promise<T>, mapper: (value: T) => U): U | Promise<U> {
  if (isPromiseLike(value)) {
    return value.then(mapper);
  }

  return mapper(value);
}

function chainMaybe<T, U>(value: T | Promise<T>, mapper: (value: T) => U | Promise<U>): U | Promise<U> {
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
