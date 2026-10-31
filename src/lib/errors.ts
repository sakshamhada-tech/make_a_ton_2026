export class AppError extends Error {
  readonly code: string;

  constructor(message: string, code = 'app_error') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'validation');
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 'forbidden');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested record was not found.') {
    super(message, 'not_found');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'conflict');
    this.name = 'ConflictError';
  }
}
