import { NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 500) {
  return new AppError(message, status)
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function notFoundResponse(message = 'Resource not found') {
  return errorResponse(message, 404)
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401)
}

export function forbiddenResponse(message = 'Forbidden') {
  return errorResponse(message, 403)
}

export function badRequestResponse(message = 'Bad request') {
  return errorResponse(message, 400)
}

export async function parseBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw apiError('Invalid JSON body', 400)
  }
}

export function handleApiError(error: unknown, fallbackMessage = 'Internal server error') {
  if (error instanceof ApiError) {
    return errorResponse(error.message, error.status)
  }

  if (error instanceof AppError) {
    return errorResponse(error.message, error.status)
  }

  console.error(error)
  return errorResponse(fallbackMessage, 500)
}
