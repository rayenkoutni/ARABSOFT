import { Request } from '@/lib/types'

export interface ParsedRequestContent {
  title: string
  description: string
}

export function parseRequestContent(request: Request): ParsedRequestContent {
  const createdEntry = request.history.find((entry) => entry.action === 'CREATED')
  const raw = request.comment ?? createdEntry?.comment ?? ''
  const fallbackTitle = request.type

  if (!raw) {
    return {
      title: fallbackTitle,
      description: '',
    }
  }

  const match = raw.match(/^\[(.+?)\]\s*-\s*([\s\S]*)$/)

  if (!match) {
    return {
      title: fallbackTitle,
      description: raw,
    }
  }

  return {
    title: match[1] || fallbackTitle,
    description: match[2] ?? '',
  }
}
