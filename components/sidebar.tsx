'use client'

import { useAuth } from '@/lib'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import {
  BarChart3,
  FileText,
  Users,
  Settings,
  CheckCircle2,
  Send,
  FolderKanban,
  MessageSquare,
  ClipboardList,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
  badge?: number
}

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/conversations')
        if (res.ok) {
          const conversations = await res.json()
          const totalUnread = conversations.reduce(
            (sum: number, conv: { unreadCount: number }) => sum + conv.unreadCount,
            0
          )
          setUnreadCount(totalUnread)
        }
      } catch (error) {
        console.error('Error fetching unread count:', error)
      }
    }

    fetchUnreadCount()

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)

    // Listen for refresh event
    const handleRefresh = () => fetchUnreadCount()
    window.addEventListener('refreshNotifications', handleRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('refreshNotifications', handleRefresh)
    }
  }, [])

  if (!user) return null

  const navItems: NavItem[] = [
    {
      label: 'Tableau de bord',
      href: '/dashboard',
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: 'Messages',
      href: '/dashboard/chat',
      icon: <MessageSquare className="h-4 w-4" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ]

  // Role-specific navigation
  if (user.role === 'RH') {
    navItems.push(
      {
        label: 'Historique des demandes',
        href: '/dashboard/requests',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'Approbations en attente',
        href: '/dashboard/approvals',
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: 'Utilisateurs',
        href: '/dashboard/users',
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: 'Competences',
        href: '/dashboard/skills',
        icon: <Sparkles className="h-4 w-4" />,
      },
      {
        label: 'Projets',
        href: '/dashboard/projects',
        icon: <FolderKanban className="h-4 w-4" />,
      },
      {
        label: 'Journal d\'audit',
        href: '/dashboard/audit',
        icon: <ClipboardList className="h-4 w-4" />,
      }
    )
  } else if (user.role === 'CHEF') {
    navItems.push(
      {
        label: 'Demandes de l\'equipe',
        href: '/dashboard/team-requests',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'Mes approbations',
        href: '/dashboard/my-approvals',
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: 'Projets',
        href: '/dashboard/projects',
        icon: <FolderKanban className="h-4 w-4" />,
      },
      {
        label: 'Competences',
        href: '/dashboard/skills',
        icon: <Sparkles className="h-4 w-4" />,
      }
    )
  } else {
    navItems.push(
      {
        label: 'Mes demandes',
        href: '/dashboard/my-requests',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'Nouvelle demande',
        href: '/dashboard/new-request',
        icon: <Send className="h-4 w-4" />,
      },
      {
        label: 'Projets',
        href: '/dashboard/projects',
        icon: <FolderKanban className="h-4 w-4" />,
      },
      {
        label: 'Competences',
        href: '/dashboard/skills',
        icon: <Sparkles className="h-4 w-4" />,
      }
    )
  }

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-sidebar">
      <div className="px-6 py-6 border-b">
        <Link href="/dashboard">
          <img src="/logo.png" alt="ARABSOFT Logo" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
              pathname === item.href
                ? 'bg-blue-50 dark:bg-slate-700 text-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-gray-50 dark:hover:bg-slate-700'
            )}
            style={pathname === item.href ? {
              backgroundColor: 'var(--color-hover)',
              color: 'var(--color-brand-blue)',
              borderLeft: '3px solid var(--color-brand-amber)'
            } : undefined}
          >
            <span style={{ color: pathname === item.href ? '#2563B0' : '#6B7280' }}>
              {item.icon}
            </span>
            <span style={{ fontWeight: pathname === item.href ? 600 : 500 }}>
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

      <div className="border-t px-3 py-4">
        <Link
          href="/dashboard/settings"
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
            pathname === '/dashboard/settings'
              ? 'bg-blue-50 dark:bg-slate-700 text-sidebar-primary'
              : 'text-sidebar-foreground hover:bg-gray-50 dark:hover:bg-slate-700'
          )}
          style={pathname === '/dashboard/settings' ? {
            backgroundColor: 'var(--color-hover)',
            color: 'var(--color-brand-blue)',
            borderLeft: '3px solid var(--color-brand-amber)'
          } : undefined}
        >
          <span style={{ color: pathname === '/dashboard/settings' ? '#2563B0' : '#6B7280' }}>
            <Settings className="h-4 w-4" />
          </span>
          <span style={{ fontWeight: pathname === '/dashboard/settings' ? 600 : 500 }}>
            Parametres
          </span>
        </Link>
      </div>
    </aside>
  )
}
