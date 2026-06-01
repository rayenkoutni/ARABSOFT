'use client'

import { ROLE } from '@/lib/constants'
import { baseNavigationItems, roleNavigationItems, settingsNavigationItem } from '@/lib/constants/nav'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { useUnreadCount } from '@/lib/hooks/useUnreadCount'

export function Sidebar() {
  const { user } = useCurrentUser()
  const pathname = usePathname()
  const unreadCount = useUnreadCount(Boolean(user))

  if (!user) return null

  const navItems = [
    ...baseNavigationItems,
    ...roleNavigationItems[user.role],
  ].map((item) => ({
    ...item,
    badge: item.href === '/dashboard/chat' && unreadCount > 0 ? unreadCount : undefined,
  }))

  return (
    <aside className="hidden md:flex flex-col md:w-20 lg:w-64 border-r bg-sidebar transition-all duration-200">
      <div className="flex px-6 py-6 md:px-2 md:py-4 border-b md:justify-center lg:justify-start">
        <Link href="/dashboard">
          <img src="/logo.png" alt="ARABSOFT Logo" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex-1 space-y-0.5 px-2 md:px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
              'md:justify-center lg:justify-start md:px-2 lg:px-4',
              pathname === item.href
                ? 'bg-blue-50 dark:bg-slate-700 text-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-gray-50 dark:hover:bg-slate-700',
            )}
            style={
              pathname === item.href
                ? {
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-brand-blue)',
                    borderLeft: '3px solid var(--color-brand-amber)',
                  }
                : undefined
            }
          >
            <span style={{ color: pathname === item.href ? '#2563B0' : '#6B7280' }}>
              <item.icon className="h-4 w-4" />
            </span>
            <span
              className="hidden lg:inline"
              style={{ fontWeight: pathname === item.href ? 600 : 500 }}
            >
              {item.label}
            </span>
            {item.badge && item.badge > 0 && (
              <span
                className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium"
                style={{ backgroundColor: '#EF4444', color: 'white' }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="border-t px-2 md:px-3 py-4">
        <Link
          href={settingsNavigationItem.href}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
            'md:justify-center lg:justify-start md:px-2 lg:px-4',
            pathname === settingsNavigationItem.href
              ? 'bg-blue-50 dark:bg-slate-700 text-sidebar-primary'
              : 'text-sidebar-foreground hover:bg-gray-50 dark:hover:bg-slate-700',
          )}
          style={
            pathname === settingsNavigationItem.href
              ? {
                  backgroundColor: 'var(--color-hover)',
                  color: 'var(--color-brand-blue)',
                  borderLeft: '3px solid var(--color-brand-amber)',
                }
              : undefined
          }
        >
          <span style={{ color: pathname === settingsNavigationItem.href ? '#2563B0' : '#6B7280' }}>
            <settingsNavigationItem.icon className="h-4 w-4" />
          </span>
          <span
            className="hidden lg:inline"
            style={{ fontWeight: pathname === settingsNavigationItem.href ? 600 : 500 }}
          >
            {settingsNavigationItem.label}
          </span>
        </Link>
      </div>
    </aside>
  )
}
