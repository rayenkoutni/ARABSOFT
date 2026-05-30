import { NextResponse } from 'next/server'
import { initCron } from '@/lib/cron'
import { apiError, handleApiError } from '@/lib/utils/api-response'

async function handleInit(req: Request) {
  try {
    const initSecret = req.headers.get('x-init-secret')

    if (!initSecret || initSecret !== process.env.INIT_SECRET) {
      throw apiError("Forbidden", 403)
    }

    initCron()
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    return handleApiError(error, "Forbidden")
  }
}

export async function GET(req: Request) {
  return handleInit(req)
}

export async function POST(req: Request) {
  return handleInit(req)
}
