'use client'

import { useState, useEffect } from 'react'
import { ROLE, type Role } from '@/lib/constants'
import { useNotificationRefresh } from '@/lib'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Settings, Bell, Menu, BarChart3, FileText, Users, CheckCircle2, Send, FolderKanban, MessageSquare, ClipboardList, Sparkles, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Navigation() {
  const { user, logout } = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()
  const { refreshKey } = useNotificationRefresh()
  const [avatar, setAvatar] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const getProfilePicture = (userId: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const profilePictures = localStorage.getItem('user_profile_pictures')
      if (profilePictures) {
        const pictures = JSON.parse(profilePictures)
        return pictures[userId] || null
      }
    } catch (error) {
      console.error('Error loading profile picture:', error)
    }
    return null
  }

  useEffect(() => {
    if (!user) return
    
    const userAvatar = getProfilePicture(user.id)
    if (userAvatar) {
      setAvatar(userAvatar)
    } else if (user?.avatar) {
      setAvatar(user.avatar)
    }

    const handleAvatarChange = () => {
      const updated = getProfilePicture(user.id)
      setAvatar(updated || user?.avatar || null)
    }
    
    window.addEventListener('avatarChange', handleAvatarChange)
    return () => window.removeEventListener('avatarChange', handleAvatarChange)
  }, [user])

   useEffect(() => {
     if (!user) return

     const fetchNotifications = async () => {
       try {
         const res = await fetch('/api/notifications')
         if (res.ok) {
           const data = await res.json()
           setNotifications(Array.isArray(data) ? data : [])
         } else {
           setNotifications([])
         }
       } catch (err) {
         console.error("Failed to fetch notifications", err)
         setNotifications([])
       }
     }

     fetchNotifications()
     // Poll every 30 seconds
     const interval = setInterval(fetchNotifications, 30000)

     // Listen for custom event to refresh notifications
     const handleRefresh = () => {
       fetchNotifications()
     }
     window.addEventListener('refreshNotifications', handleRefresh)

     return () => {
       clearInterval(interval)
       window.removeEventListener('refreshNotifications', handleRefresh)
     }
   }, [user, refreshKey])

  const handleReadNotification = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      window.dispatchEvent(new Event('refreshNotifications'))
    } catch(err) {
      // Revert if failed
    }
  }

  const handleClearAllNotifications = async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE' })
      setNotifications([])
      window.dispatchEvent(new Event('refreshNotifications'))
    } catch(err) {
      console.error("Failed to clear notifications")
    }
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!user) return null

  const initials = user.name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0].toUpperCase())
    .join('')
    .substring(0, 2)

  const unreadCount = notifications.filter(n => !n.read).length

  // Build navigation items based on user role
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

  if (user.role === ROLE.HR) {
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
      },
    )
  } else if (user.role === ROLE.MANAGER) {
    navItems.push(
      {
        label: 'Mon Equipe',
        href: '/dashboard/equipe',
        icon: <Users className="h-4 w-4" />,
      },
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
    <nav className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-brand-blue)' }}>ARAB<span style={{ color: '#F5A623' }}>SOFT</span></span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#7B8CA6', letterSpacing: '0.1em' }}>HR PORTAL</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
                    {unreadCount > 9 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAllNotifications}
                    className="text-xs hover:underline cursor-pointer"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Tout effacer
                  </button>
                )}
              </div>
              {notifications.length > 0 && unreadCount > 0 && (
                <div className="px-4 py-1 text-xs" style={{ color: 'var(--color-brand-blue)' }}>{unreadCount} non lues</div>
              )}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Aucune notification
                  </div>
                ) : (
                  notifications.map(notif => (
                    <DropdownMenuItem 
                      key={notif.id} 
                      className={`flex flex-col items-start px-4 py-3 cursor-pointer ${notif.read ? 'opacity-70' : 'bg-slate-50 dark:bg-slate-800'}`}
                      onClick={() => !notif.read && handleReadNotification(notif.id)}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{notif.title}</span>
                        {!notif.read && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-brand-blue)' }}></span>}
                      </div>
                      <span className="text-xs line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{notif.message}</span>
                      <span className="text-[10px] mt-2" style={{ color: '#94A3B8' }}>{new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="text-sm border-l pl-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>{user.name}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.role}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  {avatar && <AvatarImage src={avatar} alt={user.name} className="object-cover" />}
                  <AvatarFallback style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Parametres
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="cursor-pointer" style={{ color: 'var(--color-danger)' }}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <Drawer direction="left" open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DrawerContent className="w-80 max-w-[80vw]">
          <DrawerHeader>
            <DrawerTitle>Menu</DrawerTitle>
          </DrawerHeader>
          <nav className="flex flex-col gap-1 px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                  pathname === item.href
                    ? 'bg-blue-50 text-sidebar-primary'
                    : 'hover:bg-gray-50'
                )}
                style={pathname === item.href ? { color: 'var(--color-brand-blue)' } : {}}
              >
                <span style={{ color: pathname === item.href ? '#2563B0' : '#6B7280' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
            <Link
              href="/dashboard/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                pathname === '/dashboard/settings'
                  ? 'bg-blue-50 text-sidebar-primary'
                  : 'hover:bg-gray-50'
              )}
              style={pathname === '/dashboard/settings' ? { color: 'var(--color-brand-blue)' } : {}}
            >
              <span style={{ color: pathname === '/dashboard/settings' ? '#2563B0' : '#6B7280' }}>
                <Settings className="h-4 w-4" />
              </span>
              <span>Parametres</span>
            </Link>
          </nav>
          <DrawerFooter>
            <Button variant="outline" onClick={logout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </nav>
  )
}
