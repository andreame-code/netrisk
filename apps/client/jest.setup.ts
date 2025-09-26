import '@testing-library/jest-dom';
import { randomUUID } from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID },
  });
} else if (!('randomUUID' in globalThis.crypto)) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
  });
}
