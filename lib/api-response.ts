import { NextResponse } from 'next/server'

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
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
    throw new Error('Invalid JSON body')
  }
}
