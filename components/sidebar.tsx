'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  FileText,
  Users,
  Settings,
  CheckCircle2,
  Send,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
}

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ]

  // Role-specific navigation
  if (user.role === 'RH') {
    navItems.push(
      {
<<<<<<< HEAD
        label: 'Request History',
=======
        label: 'All Requests',
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        href: '/dashboard/requests',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'Pending Approvals',
        href: '/dashboard/approvals',
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: 'Users',
        href: '/dashboard/users',
        icon: <Users className="h-4 w-4" />,
      }
    )
  } else if (user.role === 'CHEF') {
    navItems.push(
      {
        label: 'Team Requests',
        href: '/dashboard/team-requests',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'My Approvals',
        href: '/dashboard/my-approvals',
        icon: <CheckCircle2 className="h-4 w-4" />,
      }
    )
  } else {
    navItems.push(
      {
        label: 'My Requests',
        href: '/dashboard/my-requests',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: 'New Request',
        href: '/dashboard/new-request',
        icon: <Send className="h-4 w-4" />,
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
                ? 'bg-blue-50 text-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-gray-50'
            )}
            style={pathname === item.href ? {
              backgroundColor: '#EEF4FF',
              color: '#2563B0',
              borderLeft: '3px solid #F5A623'
            } : undefined}
          >
            <span style={{ color: pathname === item.href ? '#2563B0' : '#6B7280' }}>
              {item.icon}
            </span>
            <span style={{ fontWeight: pathname === item.href ? 600 : 500 }}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      <div className="border-t px-3 py-4">
        <Link
          href="/dashboard/settings"
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
            pathname === '/dashboard/settings'
              ? 'bg-blue-50 text-sidebar-primary'
              : 'text-sidebar-foreground hover:bg-gray-50'
          )}
          style={pathname === '/dashboard/settings' ? {
            backgroundColor: '#EEF4FF',
            color: '#2563B0',
            borderLeft: '3px solid #F5A623'
          } : undefined}
        >
          <span style={{ color: pathname === '/dashboard/settings' ? '#2563B0' : '#6B7280' }}>
            <Settings className="h-4 w-4" />
          </span>
          <span style={{ fontWeight: pathname === '/dashboard/settings' ? 600 : 500 }}>
            Settings
          </span>
        </Link>
      </div>
    </aside>
  )
}
