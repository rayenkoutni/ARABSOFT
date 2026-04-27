import { NextResponse } from 'next/server'
import { initCron } from '@/lib/cron'

export async function GET() {
  initCron()
  return NextResponse.json({ status: 'ok' })
}