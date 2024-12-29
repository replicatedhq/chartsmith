export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);

    // Fix for extending built-in classes in TypeScript/JavaScript
    Object.setPrototypeOf(this, AppError.prototype);

    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  toJSON(): ApiError {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: unknown): never {
  if (isAppError(error)) {
    throw error;
  }

  throw new AppError(error instanceof Error ? error.message : "An unexpected error occurred", "UNKNOWN_ERROR", error);
}
