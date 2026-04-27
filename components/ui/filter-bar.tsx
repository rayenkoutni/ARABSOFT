'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

interface FilterBarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  typeFilter?: {
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
    label?: string
  }
  dateFilter?: {
    startDate: string
    endDate: string
    onStartDateChange: (value: string) => void
    onEndDateChange: (value: string) => void
  }
}

export function FilterBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  typeFilter,
  dateFilter
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {(typeFilter || dateFilter) && (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:flex-wrap">
          {dateFilter && (
            <>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Filtrer par date :
              </span>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>de</span>
              <div className="relative w-full sm:w-52">
                <Input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => dateFilter.onStartDateChange(e.target.value)}
                  className="pr-10"
                />
                {dateFilter.startDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                    onClick={() => dateFilter.onStartDateChange('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>à</span>
              <div className="relative w-full sm:w-52">
                <Input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => dateFilter.onEndDateChange(e.target.value)}
                  className="pr-10"
                />
                {dateFilter.endDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                    onClick={() => dateFilter.onEndDateChange('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}

          {typeFilter && (
            <>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {typeFilter.label || 'Filtrer par type :'}
              </span>
              <Select value={typeFilter.value} onValueChange={typeFilter.onChange}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  {typeFilter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}
    </div>
  )
}
