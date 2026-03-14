import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../utils/logger';
import { ApiErrorResponse } from '@rxdesk/shared';

// Custom application error class
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler — must be registered LAST in Express middleware chain
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Zod validation error
  if (err instanceof ZodError || err.name === 'ZodError') {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: (err as ZodError).flatten().fieldErrors as Record<string, unknown>,
      },
    };
    res.status(422).json(response);
    return;
  }

  // Known application error
  if (err instanceof AppError || (err as any).name === 'AppError') {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: (err as any).code || 'APP_ERROR',
        message: err.message,
        details: (err as any).details,
      },
    };
    res.status((err as any).statusCode || 400).json(response);
    return;
  }

  // Payload too large (thrown by body-parser before the route handler runs)
  if ((err as any).type === 'entity.too.large' || (err as any).status === 413) {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the 10 MB limit. Split the import into batches of ≤ 2,000 rows and try again.',
      },
    } as ApiErrorResponse);
    return;
  }

  // Unknown/unexpected error — log it
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  } as ApiErrorResponse);
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  } as ApiErrorResponse);
}
