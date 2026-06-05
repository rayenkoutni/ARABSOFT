import { PROJECT_STATUS } from "@/lib/constants"
import { getTodayDateOnly, toDateOnlyValue } from "@/lib/leave-request"
import { SLA_STATUS_CONFIG } from "@/lib/status"

export const PROJECT_SLA_BREACHED_LABEL = "SLA dépassé"
export const PROJECT_SLA_BREACHED_STYLE = SLA_STATUS_CONFIG.BREACHED.style

export function hasProjectReachedPlannedEndDate(
  endDate?: string | Date | null,
  todayDate = getTodayDateOnly(),
) {
  const plannedEndDate = toDateOnlyValue(endDate)
  return Boolean(plannedEndDate && plannedEndDate <= todayDate)
}

export function isProjectSlaBreached(project: {
  endDate?: string | Date | null
  status?: string | null
  slaBreached?: boolean | null
}) {
  return Boolean(
    project.slaBreached ||
      (project.status === PROJECT_STATUS.IN_PROGRESS && hasProjectReachedPlannedEndDate(project.endDate)),
  )
}
