import { ApprovalTimeline } from "@/components/approval-timeline"
import {
  formatDateOnly,
  formatLeaveBalance,
  getLeaveDurationLabel,
  getLeaveImpactSummary,
  isLeaveRequestType,
} from "@/lib/leave-request"
import { parseRequestContent } from "@/lib/request-content"
import { Request } from "@/lib/types"

interface RequestDetailsSummaryProps {
  request: Request
  showBalanceImpact?: boolean
  showRequester?: boolean
  showHistory?: boolean
}

export function RequestDetailsSummary({
  request,
  showBalanceImpact = false,
  showRequester = false,
  showHistory = true,
}: RequestDetailsSummaryProps) {
  const { title, description } = parseRequestContent(request)
  const leaveImpact = getLeaveImpactSummary({
    startDate: request.startDate,
    endDate: request.endDate,
    leaveBalance: request.employee?.leaveBalance,
  })
  const isLeaveRequest = isLeaveRequestType(request.type)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Titre</p>
        <p className="text-sm">{title}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Description</p>
        <p className="text-sm">{description || "Aucune description"}</p>
      </div>

      {isLeaveRequest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Date de debut</p>
            <p className="text-sm">{formatDateOnly(request.startDate) || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Date de fin</p>
            <p className="text-sm">{formatDateOnly(request.endDate) || "-"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Duree demandee</p>
            <p className="text-sm">{getLeaveDurationLabel(leaveImpact.requestedDays)}</p>
          </div>
        </div>
      )}

      {showBalanceImpact && isLeaveRequest && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="mb-3 font-semibold">Impact sur le solde conge</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Solde actuel</p>
              <p className="text-sm">
                {leaveImpact.currentBalance == null ? '-' : `${formatLeaveBalance(leaveImpact.currentBalance)} jours`}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duree demandee</p>
              <p className="text-sm">{getLeaveDurationLabel(leaveImpact.requestedDays)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Solde projete</p>
              <p className="text-sm">
                {leaveImpact.projectedBalance == null ? '-' : `${formatLeaveBalance(leaveImpact.projectedBalance)} jours`}
              </p>
            </div>
          </div>
        </div>
      )}

      {showRequester && request.employee && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Demandeur</p>
          <p className="text-sm">{request.employee.name}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-muted-foreground">Statut</p>
        <p className="text-sm">{request.status}</p>
      </div>

      {showHistory && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Historique</p>
          <ApprovalTimeline history={request.history} />
        </div>
      )}
    </div>
  )
}
