/**
 * Global error handler - catches all unhandled errors
 * Formats them consistently and logs appropriately
 */
function errorHandler(err, req, res, next) {
  // Log full error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  } else {
    console.error('Error:', err.message, { path: req.path, method: req.method });
  }

  // PostgreSQL specific errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({ 
          error: 'Duplicate entry', 
          detail: extractPgDetail(err.detail) 
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({ 
          error: 'Referenced record not found',
          detail: extractPgDetail(err.detail)
        });
      case '23502': // not_null_violation
        return res.status(400).json({ 
          error: 'Required field missing',
          field: err.column
        });
      case '22P02': // invalid_text_representation
        return res.status(400).json({ error: 'Invalid ID format' });
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message, fields: err.fields });
  }

  // Default 500
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

function extractPgDetail(detail) {
  if (!detail) return undefined;
  const match = detail.match(/Key \((.+)\)=\((.+)\)/);
  if (match) return `${match[1]} '${match[2]}' already exists`;
  return detail;
}

/**
 * Async route wrapper - catches async errors and passes to error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a named application error
 */
function AppError(message, statusCode = 400, fields = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (fields) err.fields = fields;
  return err;
}

module.exports = { errorHandler, asyncHandler, AppError };
