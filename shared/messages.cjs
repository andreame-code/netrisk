function createLocalizedError(message, messageKey, messageParams = {}, code = null) {
  const error = new Error(message);
  error.messageKey = messageKey || null;
  error.messageParams = messageParams || {};
  if (code) {
    error.code = code;
  }
  return error;
}

function createActionFailure(message, messageKey, messageParams = {}) {
  return {
    ok: false,
    message,
    messageKey,
    messageParams
  };
}

function createDomainFailure(error, messageKey, messageParams = {}) {
  return {
    ok: false,
    error,
    errorKey: messageKey,
    errorParams: messageParams
  };
}

function createValidationFailure(reason, reasonKey, reasonParams = {}) {
  return {
    ok: false,
    reason,
    reasonKey,
    reasonParams
  };
}

function createLogEntry(message, messageKey, messageParams = {}) {
  return {
    message,
    messageKey: messageKey || null,
    messageParams: messageParams || {}
  };
}

module.exports = {
  createActionFailure,
  createDomainFailure,
  createLogEntry,
  createLocalizedError,
  createValidationFailure
};
