import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatDate(date: Date | string, formatString: string = 'dd MMM yyyy'): string {
  return format(new Date(date), formatString, { locale: fr })
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy HH:mm', { locale: fr })
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm', { locale: fr })
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

export function formatProjectDate(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy', { locale: fr })
}

export function formatTaskDate(date: Date | string): string {
  return format(new Date(date), 'dd MMM', { locale: fr })
}
