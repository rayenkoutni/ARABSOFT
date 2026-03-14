'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Settings, Bell } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function Navigation() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [avatar, setAvatar] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    // Load existing avatar
    const saved = localStorage.getItem('user_avatar')
    if (saved) setAvatar(saved)

    // Listen for changes from Settings page
    const handleAvatarChange = () => {
      const updated = localStorage.getItem('user_avatar')
      setAvatar(updated)
    }
    
    window.addEventListener('avatarChange', handleAvatarChange)
    return () => window.removeEventListener('avatarChange', handleAvatarChange)
  }, [])

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotifications(data)
        }
      } catch (err) {
        console.error("Failed to fetch notifications")
      }
    }

    fetchNotifications()
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleReadNotification = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    } catch(err) {
      // Revert if failed
    }
  }

  if (!user) return null

  const initials = user.name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0].toUpperCase())
    .join('')
    .substring(0, 2)

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <nav className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-brand-blue)' }}>ARAB<span style={{ color: '#F5A623' }}>SOFT</span></span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7B8CA6', letterSpacing: '0.1em' }}>HR PORTAL</span>
        </Link>

        <div className="flex items-center gap-4">
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>Notifications</span>
                {unreadCount > 0 && <span className="text-xs" style={{ color: 'var(--color-brand-blue)' }}>{unreadCount} non lues</span>}
              </div>
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
                Paramètres
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
    </nav>
  )
}
