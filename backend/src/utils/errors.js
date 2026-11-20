class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, message, details);
const unauthorized = (message = 'Authentication required') => new HttpError(401, message);
const notFound = (message = 'Resource not found') => new HttpError(404, message);
const conflict = (message, details) => new HttpError(409, message, details);

// Wrap async/sync route handlers so thrown errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, unauthorized, notFound, conflict, asyncHandler };
