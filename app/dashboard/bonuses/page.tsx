'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { BrandedLoading } from '@/components/ui/spinner'
import { ROLE } from '@/lib/constants'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { fetchBonuses } from '@/lib/services/client/bonuses.service'
import { format } from 'date-fns'
import { Coins, Gift, History, ArrowLeft } from 'lucide-react'
import { formatAmountTnd, formatFrenchDate, formatFrenchMonthYear, getBonusReasonLabel, getBonusTypeLabel, getMonthlyBounds } from '@/lib/payslip'

interface BonusHistoryItem {
  id: string
  amount: number
  type: string
  reason: string | null
  period: string | null
  createdAt: string
  paidAt: string | null
}

function getBonusMonthKey(bonus: BonusHistoryItem) {
  if (bonus.period && /^\d{4}-\d{2}$/.test(bonus.period)) {
    return bonus.period
  }

  if (bonus.period && /^\d{4}$/.test(bonus.period)) {
    return null
  }

  return format(new Date(bonus.createdAt), 'yyyy-MM')
}

function getBonusYearKey(bonus: BonusHistoryItem) {
  if (bonus.period && /^\d{4}-\d{2}$/.test(bonus.period)) {
    return bonus.period.slice(0, 4)
  }

  if (bonus.period && /^\d{4}$/.test(bonus.period)) {
    return bonus.period
  }

  return format(new Date(bonus.createdAt), 'yyyy')
}

function getBonusMonthLabel(monthKey: string) {
  return formatFrenchMonthYear(getMonthlyBounds(monthKey).start)
}

function getBonusGroupKey(bonus: BonusHistoryItem) {
  if (bonus.period && /^\d{4}$/.test(bonus.period)) {
    return `year:${bonus.period}`
  }

  const monthKey = getBonusMonthKey(bonus)
  return `month:${monthKey ?? format(new Date(bonus.createdAt), 'yyyy-MM')}`
}

function getBonusGroupLabel(groupKey: string) {
  if (groupKey.startsWith('year:')) {
    return `Annee ${groupKey.slice(5)}`
  }

  return getBonusMonthLabel(groupKey.slice(6))
}

function getBonusDisplayPeriod(bonus: BonusHistoryItem) {
  if (bonus.period && /^\d{4}-\d{2}$/.test(bonus.period)) {
    return getBonusMonthLabel(bonus.period)
  }

  if (bonus.period) {
    return bonus.period
  }

  const monthKey = getBonusMonthKey(bonus)
  return getBonusMonthLabel(monthKey ?? format(new Date(bonus.createdAt), 'yyyy-MM'))
}

export default function BonusHistoryPage() {
  const { user, isLoading: authLoading } = useCurrentUser()
  const router = useRouter()
  const [bonuses, setBonuses] = useState<BonusHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')

  useEffect(() => {
    if (!authLoading && user && user.role !== ROLE.EMPLOYEE) {
      router.push('/dashboard')
    }
  }, [authLoading, router, user])

  useEffect(() => {
    const loadBonuses = async () => {
      if (!user || user.role !== ROLE.EMPLOYEE) return

      try {
        setIsLoading(true)
        setLoadError(null)

        const data = await fetchBonuses(user.id)
        setBonuses(Array.isArray(data) ? data : [])
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Impossible de charger les bonus')
      } finally {
        setIsLoading(false)
      }
    }

    void loadBonuses()
  }, [user])

  if (!user) return null

  const yearOptions = Array.from(new Set(bonuses.map((bonus) => getBonusYearKey(bonus)))).sort((a, b) => b.localeCompare(a))
  const monthOptions = Array.from(
    new Set(
      bonuses
        .filter((bonus) => selectedYear === 'all' || getBonusYearKey(bonus) === selectedYear)
        .map((bonus) => getBonusMonthKey(bonus))
        .filter((monthKey): monthKey is string => Boolean(monthKey)),
    ),
  ).sort((a, b) => b.localeCompare(a))

  const filteredBonuses = bonuses.filter((bonus) => {
    if (selectedYear !== 'all' && getBonusYearKey(bonus) !== selectedYear) {
      return false
    }

    if (selectedMonth !== 'all' && getBonusMonthKey(bonus) !== selectedMonth) {
      return false
    }

    return true
  })

  const groupKeys = Array.from(new Set(filteredBonuses.map((bonus) => getBonusGroupKey(bonus)))).sort((a, b) => b.localeCompare(a))

  const groupedBonuses = groupKeys
    .map((groupKey) => {
      const items = filteredBonuses.filter((bonus) => getBonusGroupKey(bonus) === groupKey)
      const total = items.reduce((sum, bonus) => sum + bonus.amount, 0)

      return {
        groupKey,
        label: getBonusGroupLabel(groupKey),
        total,
        items,
      }
    })
    .filter((group) => group.items.length > 0)

  const visibleTotal = filteredBonuses.reduce((sum, bonus) => sum + bonus.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm" style={{ color: 'var(--color-brand-blue)' }}>
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Historique des bonus
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Suivez vos bonus mensuels et consultez les mois precedents.
          </p>
        </div>
        <Link href="/dashboard/projects">
          <Button variant="outline">Voir mes projets</Button>
        </Link>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-t-4 p-5" style={{ borderTopColor: '#F5A623' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Total affiche
            </p>
            <Coins className="h-4 w-4" style={{ color: '#D97706' }} />
          </div>
          <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            {formatAmountTnd(visibleTotal)}
          </p>
        </Card>

        <Card className="border-t-4 p-5" style={{ borderTopColor: '#2563B0' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Nombre de bonus
            </p>
            <Gift className="h-4 w-4" style={{ color: '#2563B0' }} />
          </div>
          <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            {filteredBonuses.length}
          </p>
        </Card>

        <Card className="border-t-4 p-5" style={{ borderTopColor: '#0F766E' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Mois suivis
            </p>
            <History className="h-4 w-4" style={{ color: '#0F766E' }} />
          </div>
          <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            {groupedBonuses.length}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Filtrer par annee
            </p>
            <Select
              value={selectedYear}
              onValueChange={(value) => {
                setSelectedYear(value)
                setSelectedMonth('all')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes les annees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les annees</SelectItem>
                {yearOptions.map((yearKey) => (
                  <SelectItem key={yearKey} value={yearKey}>
                    {yearKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Filtrer par mois
            </p>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les mois" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                {monthOptions.map((monthKey) => (
                  <SelectItem key={monthKey} value={monthKey}>
                    {getBonusMonthLabel(monthKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="py-12 text-center">
          <BrandedLoading />
        </div>
      ) : groupedBonuses.length > 0 ? (
        <div className="space-y-4">
          {groupedBonuses.map((group) => (
            <Card key={group.groupKey} className="p-5">
              <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                    {group.label}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {group.items.length} bonus enregistre{group.items.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Total du mois
                  </p>
                  <p className="text-lg font-semibold" style={{ color: '#D97706' }}>
                    {formatAmountTnd(group.total)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {group.items.map((bonus) => (
                  <div
                    key={bonus.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(245, 248, 252, 0.8)' }}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {getBonusReasonLabel(bonus.reason, bonus.type)}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {getBonusTypeLabel(bonus.type)} - Periode: {getBonusDisplayPeriod(bonus)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Cree le {formatFrenchDate(new Date(bonus.createdAt))}
                        {bonus.paidAt ? ` - Verse le ${formatFrenchDate(new Date(bonus.paidAt))}` : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-semibold" style={{ color: '#B45309' }}>
                        {formatAmountTnd(bonus.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Gift}
          message="Aucun bonus a afficher"
          description="Essayez un autre filtre ou attendez la prochaine evaluation mensuelle."
        />
      )}
    </div>
  )
}
