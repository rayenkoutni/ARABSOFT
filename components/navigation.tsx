'use client'

import { useState, useEffect } from 'react'
import { ROLE } from '@/lib/constants'
import { baseNavigationItems, roleNavigationItems, settingsNavigationItem } from '@/lib/constants/nav'
import { useUnreadCount } from '@/lib/hooks/useUnreadCount'
import { clearNotifications, fetchNotifications, markNotificationAsRead } from '@/lib/services/client/notifications.service'
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
import { LogOut, Bell, Menu, Settings } from 'lucide-react'
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

function unwrapNotificationsResponse(
  response: Notification[] | { data?: Notification[] }
): Notification[] {
  if (Array.isArray(response)) {
    return response
  }

  return Array.isArray(response.data) ? response.data : []
}

export function Navigation() {
  const { user, logout, socket } = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()
  const { refreshKey } = useNotificationRefresh()
  const [avatar, setAvatar] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = useUnreadCount(Boolean(user))

  const getProfilePicture = (userId: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const profilePictures = localStorage.getItem('user_profile_pictures')
      if (profilePictures) {
        const pictures = JSON.parse(profilePictures)
        return pictures[userId] || null
      }
    } catch (error) {
      console.error('[Navigation]', error)
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

     const loadNotifications = async () => {
       try {
         const data = await fetchNotifications({ limit: 30 })
         setNotifications(
           unwrapNotificationsResponse(data as Notification[] | { data?: Notification[] })
         )
       } catch (err) {
         console.error('[Navigation]', err)
         setNotifications([])
       }
     }

     loadNotifications()
     // Poll every 30 seconds
     const interval = setInterval(loadNotifications, 30000)

     const handleSocketNotification = (notification: Notification) => {
       setNotifications((current) => {
         const alreadyExists = current.some((item) => item.id === notification.id)
         if (alreadyExists) {
           return current.map((item) => (item.id === notification.id ? notification : item))
         }

         return [notification, ...current]
       })
     }

     // Listen for custom event to refresh notifications
     const handleRefresh = () => {
       void loadNotifications()
     }
     window.addEventListener('refreshNotifications', handleRefresh)
     socket?.on('new_notification', handleSocketNotification)

     return () => {
       clearInterval(interval)
       window.removeEventListener('refreshNotifications', handleRefresh)
       socket?.off('new_notification', handleSocketNotification)
     }
   }, [user, refreshKey, socket])

  const handleReadNotification = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    
    try {
      await markNotificationAsRead(id)
      window.dispatchEvent(new Event('refreshNotifications'))
    } catch (error) {
      console.error('[Navigation]', error)
      // Revert if failed
    }
  }

  const handleClearAllNotifications = async () => {
    try {
      await clearNotifications()
      setNotifications([])
      window.dispatchEvent(new Event('refreshNotifications'))
    } catch (error) {
      console.error('[Navigation]', error)
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

  const notificationUnreadCount = notifications.filter(n => !n.read).length

  const navItems = [
    ...baseNavigationItems,
    ...roleNavigationItems[user.role],
  ].map((item) => ({
    ...item,
    badge: item.href === '/dashboard/chat' && unreadCount > 0 ? unreadCount : undefined,
  }))

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
              <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Voir les notifications">
                <Bell className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                {notificationUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
                    {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
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
              {notifications.length > 0 && notificationUnreadCount > 0 && (
                <div className="px-4 py-1 text-xs" style={{ color: 'var(--color-brand-blue)' }}>{notificationUnreadCount} non lues</div>
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
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu utilisateur">
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
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
            <Link
              href={settingsNavigationItem.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                pathname === settingsNavigationItem.href
                  ? 'bg-blue-50 text-sidebar-primary'
                  : 'hover:bg-gray-50'
              )}
              style={pathname === settingsNavigationItem.href ? { color: 'var(--color-brand-blue)' } : {}}
            >
              <span style={{ color: pathname === settingsNavigationItem.href ? '#2563B0' : '#6B7280' }}>
                <settingsNavigationItem.icon className="h-4 w-4" />
              </span>
              <span>{settingsNavigationItem.label}</span>
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
