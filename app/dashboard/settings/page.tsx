'use client'

import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { user, logout, switchRole } = useAuth()
  const router = useRouter()

  if (!user) return null

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const handleSwitchRole = (role: any) => {
    if (switchRole) {
      switchRole(role)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Settings</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-text)' }}>Profile Information</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Name</label>
            <p className="mt-1" style={{ color: 'var(--color-text)' }}>{user.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Email</label>
            <p className="mt-1" style={{ color: 'var(--color-text)' }}>{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Role</label>
            <p className="mt-1" style={{ color: 'var(--color-text)' }}>{user.role}</p>
          </div>
          {user.department && (
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Department</label>
              <p className="mt-1" style={{ color: 'var(--color-text)' }}>{user.department}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Demo Mode - Switch Role */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Demo Mode</h2>
        <Alert className="mb-4">
          <Settings className="h-4 w-4" />
          <AlertDescription>
            You're in demo mode. Switch between roles to explore different dashboards.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <Button
            onClick={() => handleSwitchRole('RH')}
            variant={user.role === 'RH' ? 'default' : 'outline'}
            className="w-full justify-start"
          >
            HR Admin
          </Button>
          <Button
            onClick={() => handleSwitchRole('CHEF')}
            variant={user.role === 'CHEF' ? 'default' : 'outline'}
            className="w-full justify-start"
          >
            Manager
          </Button>
          <Button
            onClick={() => handleSwitchRole('COLLABORATEUR')}
            variant={user.role === 'COLLABORATEUR' ? 'default' : 'outline'}
            className="w-full justify-start"
          >
            Employee
          </Button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-destructive/20 bg-destructive/5">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sign out of your account and return to the login page.
        </p>
        <Button
          onClick={handleLogout}
          variant="destructive"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </Card>
    </div>
  )
}
