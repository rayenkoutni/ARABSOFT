'use client'

import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings } from 'lucide-react'
import Link from 'next/link'

export function Navigation() {
  const { user, logout } = useAuth()

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')

  return (
    <nav className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.05em', color: '#2563B0' }}>ARAB<span style={{ color: '#F5A623' }}>SOFT</span></span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7B8CA6', letterSpacing: '0.1em' }}>HR PORTAL</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>{user.name}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.role}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} style={{ color: 'var(--color-danger)' }}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
