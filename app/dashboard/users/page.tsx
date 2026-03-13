'use client'

import { useAuth } from '@/lib/auth-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { User } from 'lucide-react'

// Mock user data
const mockUsers = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'RH',
    department: 'Human Resources',
    status: 'Active',
  },
  {
    id: '2',
    name: 'Manager User',
    email: 'manager@company.com',
    role: 'CHEF',
    department: 'Operations',
    status: 'Active',
  },
  {
    id: '3',
    name: 'Employee User',
    email: 'employee@company.com',
    role: 'COLLABORATEUR',
    department: 'Sales',
    status: 'Active',
  },
  {
    id: '4',
    name: 'John Smith',
    email: 'john.smith@company.com',
    role: 'COLLABORATEUR',
    department: 'Marketing',
    status: 'Active',
  },
  {
    id: '5',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    role: 'CHEF',
    department: 'Engineering',
    status: 'Active',
  },
  {
    id: '6',
    name: 'Mike Brown',
    email: 'mike.brown@company.com',
    role: 'COLLABORATEUR',
    department: 'Support',
    status: 'Inactive',
  },
]

const roleColors: Record<string, { bg: string; text: string; style?: React.CSSProperties }> = {
  RH: { bg: 'bg-blue-100', text: 'text-blue-700', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  CHEF: { bg: 'bg-amber-100', text: 'text-amber-700', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  COLLABORATEUR: { bg: 'bg-green-100', text: 'text-green-700', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
}

const roleLabels: Record<string, string> = {
  RH: 'HR Admin',
  CHEF: 'Manager',
  COLLABORATEUR: 'Employee',
}

export default function UsersPage() {
  const { user } = useAuth()

  if (!user || user.role !== 'RH') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Access denied. This page is for HR administrators only.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Users Management</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Manage all users in the HR portal
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockUsers.map((u) => {
              const roleColor = roleColors[u.role]
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${roleColor.bg} ${roleColor.text} border-0`}
                      style={roleColor.style}
                    >
                      {roleLabels[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.status === 'Active' ? 'default' : 'secondary'}
                    >
                      {u.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(37, 99, 176, 0.1)' }}>
              <User className="h-4 w-4" style={{ color: 'var(--color-brand-blue)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Users</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{mockUsers.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <User className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Active Users</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{mockUsers.filter(u => u.status === 'Active').length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-hover)' }}>
              <User className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Inactive Users</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{mockUsers.filter(u => u.status === 'Inactive').length}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
