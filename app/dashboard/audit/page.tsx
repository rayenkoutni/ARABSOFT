'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandedLoading } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLog {
  id: string
  actorId: string
  actorName: string
  action: string
  entity: string
  entityId: string
  details: string | null
  createdAt: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDetails(details: string | null): string {
  if (!details) return '-'
  try {
    const parsed = JSON.parse(details)
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
  } catch {
    return details
  }
}

const entityTypes = [
  'Request',
  'Employee',
  'Project',
  'Task',
  'Evaluation',
  'Conversation',
  'Notification'
]

export default function AuditPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (searchTerm) params.append('search', searchTerm)
      if (selectedEntity !== 'all') params.append('entity', selectedEntity)

      const res = await fetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } finally {
      setIsLoading(false)
    }
  }, [user, page, searchTerm, selectedEntity])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedEntity])

  if (!user || user.role !== 'RH') {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>
          Journal d&apos;audit
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Consultez l&apos;historique des actions effectuees dans le systeme
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Rechercher par nom de l'acteur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedEntity} onValueChange={setSelectedEntity}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Date</TableHead>
              <TableHead className="w-40">Acteur</TableHead>
              <TableHead className="w-32">Action</TableHead>
              <TableHead className="w-32">Entite</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <BrandedLoading />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                  Aucune entree dans le journal
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                  <TableCell>{log.actorName}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entity}</TableCell>
                  <TableCell className="max-w-xs truncate" title={formatDetails(log.details)}>
                    {formatDetails(log.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage de {(page - 1) * 20 + 1} a {Math.min(page * 20, total)} sur {total} entrees
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} sur {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
