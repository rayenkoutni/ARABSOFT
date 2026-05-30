import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  Circle,
  Document,
  G,
  Image,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import { Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png")

const REQUEST_TYPE_LABELS: Record<string, string> = {
  CONGE: "Conge",
  AUTORISATION: "Autorisation",
  DOCUMENT: "Document",
  PRET: "Pret",
}

const STATUS_BREAKDOWN_COLORS = {
  approved: "#16a34a",
  rejected: "#dc2626",
  pending: "#d97706",
}

const REPORT_COLORS = {
  navy: "#12335b",
  blue: "#2563eb",
  sky: "#0ea5e9",
  slate: "#475569",
  border: "#d7e1ec",
  surface: "#f8fafc",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  muted: "#64748b",
}

interface DashboardReportActor {
  id: string
  name: string
  role: Role
}

interface DashboardReportPayload {
  generatedAt: Date
  generatedByName: string
  generatedByRole: Role
  audienceLabel: string
  stats: {
    totalRequests: number
    pendingRequests: number
    approvedRequests: number
    rejectedRequests: number
  }
  sla: {
    breachedThisMonth: number
    breachTrend: Array<{ date: string; count: number; label: string }>
    breachByType: Array<{ label: string; count: number }>
  }
  statusBreakdown: Array<{
    label: string
    count: number
    percentage: number
    color: string
  }>
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 54,
    paddingLeft: 24,
    backgroundColor: "#ffffff",
    fontSize: 10.5,
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  headerCard: {
    backgroundColor: REPORT_COLORS.navy,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerBrand: {
    width: 88,
    height: 30,
    objectFit: "contain",
    marginBottom: 8,
  },
  headerEyebrow: {
    color: "#bfdbfe",
    fontSize: 9,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#dbeafe",
    fontSize: 9.2,
    lineHeight: 1.2,
    maxWidth: 300,
  },
  headerMetaWrap: {
    width: 170,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 9,
  },
  headerMetaLabel: {
    fontSize: 8,
    color: "#bfdbfe",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerMetaValue: {
    fontSize: 9.4,
    color: "#ffffff",
    marginBottom: 5,
    lineHeight: 1.2,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: REPORT_COLORS.navy,
    marginTop: 2,
    marginBottom: 2,
    lineHeight: 1.2,
  },
  sectionDescription: {
    fontSize: 8.6,
    color: REPORT_COLORS.muted,
    marginTop: 0,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 9,
    paddingLeft: 10,
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    backgroundColor: REPORT_COLORS.surface,
  },
  kpiLabel: {
    fontSize: 8.6,
    color: REPORT_COLORS.muted,
    marginBottom: 5,
    lineHeight: 1.2,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 700,
    color: REPORT_COLORS.navy,
    marginBottom: 2,
    lineHeight: 1.2,
  },
  kpiHint: {
    fontSize: 7.8,
    color: REPORT_COLORS.slate,
    lineHeight: 1.2,
  },
  panelGrid: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  panelWide: {
    width: "63%",
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 9,
  },
  panelNarrow: {
    width: "37%",
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 9,
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: REPORT_COLORS.navy,
    marginBottom: 1,
    lineHeight: 1.2,
  },
  panelSubtitle: {
    fontSize: 7.9,
    color: REPORT_COLORS.muted,
    marginBottom: 5,
    lineHeight: 1.2,
  },
  legendRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 7.8,
    color: REPORT_COLORS.slate,
    lineHeight: 1.2,
  },
  breakdownCard: {
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    borderRadius: 14,
    backgroundColor: REPORT_COLORS.surface,
    padding: 10,
  },
  breakdownRow: {
    marginBottom: 9,
  },
  breakdownRowLast: {
    marginBottom: 0,
  },
  breakdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 9,
    color: REPORT_COLORS.navy,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  breakdownValue: {
    fontSize: 8.8,
    color: REPORT_COLORS.slate,
    lineHeight: 1.2,
  },
  breakdownTrack: {
    width: "100%",
    height: 7,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  breakdownFill: {
    height: 7,
    borderRadius: 999,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 24,
    right: 24,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: REPORT_COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: REPORT_COLORS.muted,
    lineHeight: 1.2,
  },
})

function buildRoleScopedRequestWhere(actor: DashboardReportActor) {
  if (actor.role === Role.CHEF) {
    return {
      employee: {
        managerId: actor.id,
      },
    }
  }

  return {}
}

function buildRoleScopedSlaWhere(actor: DashboardReportActor, startOfYear: Date) {
  const baseWhere: Record<string, unknown> = {
    createdAt: { gte: startOfYear },
    status: { notIn: ["BROUILLON"] },
  }

  if (actor.role === Role.CHEF) {
    baseWhere.employee = { managerId: actor.id }
  }

  return baseWhere
}

function formatFrenchDateTime(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function formatShortDateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

async function fileToDataUrl(filePath: string, mimeType: string) {
  const buffer = await readFile(filePath)
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

function buildTrendPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ""

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
}

function DashboardTrendChart({
  data,
}: {
  data: DashboardReportPayload["sla"]["breachTrend"]
}) {
  const width = 300
  const height = 148
  const paddingLeft = 24
  const paddingRight = 8
  const paddingTop = 12
  const paddingBottom = 20
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const maxValue = Math.max(1, ...data.map((entry) => entry.count))
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth

  const points = data.map((entry, index) => ({
    x: paddingLeft + index * stepX,
    y: paddingTop + chartHeight - (entry.count / maxValue) * chartHeight,
    count: entry.count,
    label: entry.label,
  }))

  const areaPath = points.length > 0
    ? `${buildTrendPath(points)} L ${points[points.length - 1]?.x ?? paddingLeft} ${paddingTop + chartHeight} L ${points[0]?.x ?? paddingLeft} ${paddingTop + chartHeight} Z`
    : ""

  const yTicks = [0, Math.ceil(maxValue / 2), maxValue]

  return (
    <Svg width={width} height={height}>
      {yTicks.map((tick, index) => {
        const y = paddingTop + chartHeight - (tick / maxValue) * chartHeight

        return (
          <G key={`grid-${index}`}>
            <Line
              x1={paddingLeft}
              y1={y}
              x2={paddingLeft + chartWidth}
              y2={y}
              stroke="#dbe4ef"
              strokeWidth={1}
            />
            <Text
              style={{ fontSize: 7, color: REPORT_COLORS.muted }}
              x={4}
              y={y + 3}
            >
              {String(tick)}
            </Text>
          </G>
        )
      })}

      {areaPath ? (
        <Path d={areaPath} fill="#dbeafe" />
      ) : null}
      {points.length > 1 ? (
        <Path d={buildTrendPath(points)} stroke={REPORT_COLORS.blue} strokeWidth={3} fill="none" />
      ) : null}
      {points.map((point, index) => (
        <G key={`point-${index}`}>
          <Circle cx={point.x} cy={point.y} r={3.6} fill={REPORT_COLORS.blue} />
          {index % 5 === 0 || index === points.length - 1 ? (
            <Text
              style={{ fontSize: 6.8, color: REPORT_COLORS.muted }}
              x={point.x - 9}
              y={height - 6}
            >
              {point.label}
            </Text>
          ) : null}
        </G>
      ))}
    </Svg>
  )
}

function DashboardTypeBarChart({
  data,
}: {
  data: DashboardReportPayload["sla"]["breachByType"]
}) {
  const width = 170
  const height = 148
  const paddingLeft = 12
  const paddingRight = 8
  const paddingTop = 12
  const paddingBottom = 26
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const maxValue = Math.max(1, ...data.map((entry) => entry.count))
  const barGap = 8
  const barWidth = data.length > 0 ? (chartWidth - barGap * (data.length - 1)) / data.length : chartWidth

  return (
    <Svg width={width} height={height}>
      <Line
        x1={paddingLeft}
        y1={paddingTop + chartHeight}
        x2={paddingLeft + chartWidth}
        y2={paddingTop + chartHeight}
        stroke="#dbe4ef"
        strokeWidth={1}
      />
      {data.map((entry, index) => {
        const barHeight = (entry.count / maxValue) * chartHeight
        const x = paddingLeft + index * (barWidth + barGap)
        const y = paddingTop + chartHeight - barHeight

        return (
          <G key={entry.label}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              fill={REPORT_COLORS.sky}
              rx={5}
              ry={5}
            />
            <Text
              style={{ fontSize: 7, color: REPORT_COLORS.navy, fontWeight: 700 }}
              x={x + barWidth / 2 - 2}
              y={y - 4}
            >
              {String(entry.count)}
            </Text>
            <Text
              style={{ fontSize: 6.2, color: REPORT_COLORS.muted }}
              x={x + barWidth / 2 - 10}
              y={height - 8}
            >
              {entry.label}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

export async function getDashboardReportPayload(actor: DashboardReportActor): Promise<DashboardReportPayload> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const scopedRequestWhere = buildRoleScopedRequestWhere(actor)
  const scopedSlaWhere = buildRoleScopedSlaWhere(actor, startOfYear)

  const [totalRequests, pendingRequests, approvedRequests, rejectedRequests, breachedThisMonth, breachByType] =
    await Promise.all([
      prisma.request.count({ where: scopedRequestWhere }),
      prisma.request.count({
        where: {
          ...scopedRequestWhere,
          status: { in: ["EN_ATTENTE_CHEF", "EN_ATTENTE_RH"] },
        },
      }),
      prisma.request.count({
        where: {
          ...scopedRequestWhere,
          status: "APPROUVE",
        },
      }),
      prisma.request.count({
        where: {
          ...scopedRequestWhere,
          status: "REJETE",
        },
      }),
      prisma.request.count({
        where: {
          ...scopedSlaWhere,
          slaStatus: "BREACHED",
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.request.groupBy({
        by: ["type"],
        where: {
          ...scopedSlaWhere,
          slaStatus: "BREACHED",
        },
        _count: { type: true },
      }),
    ])

  const breachTrendCounts = await Promise.all(
    Array.from({ length: 30 }, async (_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (29 - index))
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      const count = await prisma.request.count({
        where: {
          ...scopedSlaWhere,
          slaStatus: "BREACHED",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      return {
        date: startOfDay.toISOString().split("T")[0],
        count,
        label: formatShortDateLabel(startOfDay.toISOString()),
      }
    }),
  )

  const statusDenominator = totalRequests || 1
  const statusBreakdown = [
    {
      label: "Approuvees",
      count: approvedRequests,
      percentage: roundPercent((approvedRequests / statusDenominator) * 100),
      color: STATUS_BREAKDOWN_COLORS.approved,
    },
    {
      label: "Rejetees",
      count: rejectedRequests,
      percentage: roundPercent((rejectedRequests / statusDenominator) * 100),
      color: STATUS_BREAKDOWN_COLORS.rejected,
    },
    {
      label: "En attente",
      count: pendingRequests,
      percentage: roundPercent((pendingRequests / statusDenominator) * 100),
      color: STATUS_BREAKDOWN_COLORS.pending,
    },
  ]

  const normalizedBreachByType = breachByType.length > 0
    ? breachByType.map((item) => ({
        label: REQUEST_TYPE_LABELS[item.type] || item.type,
        count: item._count.type,
      }))
    : [
        { label: "Conge", count: 0 },
        { label: "Autorisation", count: 0 },
        { label: "Document", count: 0 },
        { label: "Pret", count: 0 },
      ]

  return {
    generatedAt: now,
    generatedByName: actor.name,
    generatedByRole: actor.role,
    audienceLabel: actor.role === Role.RH ? "Vue globale RH" : "Vue equipe manager",
    stats: {
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
    },
    sla: {
      breachedThisMonth,
      breachTrend: breachTrendCounts,
      breachByType: normalizedBreachByType,
    },
    statusBreakdown,
  }
}

export async function generateDashboardReportPdf(payload: DashboardReportPayload) {
  const logoDataUrl = await fileToDataUrl(LOGO_PATH, "image/png")
  const generatedAtLabel = formatFrenchDateTime(payload.generatedAt)
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(payload.generatedAt)

  return renderToBuffer(
    <Document title="Rapport de Performance - Tableau de Bord">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerCard} wrap={false}>
          <View style={styles.headerTop}>
            <View>
              <Image src={logoDataUrl} style={styles.headerBrand} />
              <Text style={styles.headerEyebrow}>Executive Summary Report</Text>
              <Text style={styles.headerTitle}>Rapport de Performance - Tableau de Bord</Text>
              <Text style={styles.headerSubtitle}>
                Synthese decisionnelle des flux RH et du respect SLA sur le perimetre actuellement autorise.
              </Text>
            </View>

            <View style={styles.headerMetaWrap}>
              <Text style={styles.headerMetaLabel}>Date de generation</Text>
              <Text style={styles.headerMetaValue}>{generatedAtLabel}</Text>
              <Text style={styles.headerMetaLabel}>Genere par</Text>
              <Text style={styles.headerMetaValue}>{payload.generatedByName}</Text>
              <Text style={styles.headerMetaLabel}>Perimetre</Text>
              <Text style={styles.headerMetaValue}>{payload.audienceLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Synthese KPI</Text>
          <Text style={styles.sectionDescription}>
            Instantane des demandes et des alertes critiques actuellement visibles dans le tableau de bord.
          </Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total des demandes</Text>
              <Text style={styles.kpiValue}>{payload.stats.totalRequests}</Text>
              <Text style={styles.kpiHint}>Volume global du perimetre exporte</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Approbations en attente</Text>
              <Text style={styles.kpiValue}>{payload.stats.pendingRequests}</Text>
              <Text style={styles.kpiHint}>Elements necessitant un suivi actif</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Depassements SLA</Text>
              <Text style={styles.kpiValue}>{payload.sla.breachedThisMonth}</Text>
              <Text style={styles.kpiHint}>{`Cumule sur ${monthLabel}`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Performance SLA sur 30 jours</Text>
          <Text style={styles.sectionDescription}>
            Evolution quotidienne des depassements SLA et points de friction par type de demande.
          </Text>

          <View style={styles.panelGrid} wrap={false}>
            <View style={styles.panelWide} wrap={false}>
              <Text style={styles.panelTitle}>Tendance des depassements</Text>
              <Text style={styles.panelSubtitle}>30 derniers jours glissants</Text>
              <DashboardTrendChart data={payload.sla.breachTrend} />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: REPORT_COLORS.blue }]} />
                  <Text style={styles.legendText}>Courbe des incidents SLA</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#dbeafe" }]} />
                  <Text style={styles.legendText}>Zone de variation journaliere</Text>
                </View>
              </View>
            </View>

            <View style={styles.panelNarrow} wrap={false}>
              <Text style={styles.panelTitle}>Breaches par type</Text>
              <Text style={styles.panelSubtitle}>Accumule annuel sur le perimetre</Text>
              <DashboardTypeBarChart data={payload.sla.breachByType} />
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Repartition des statuts</Text>
          <Text style={styles.sectionDescription}>
            Distribution structuree des demandes entre traitees, rejetees et encore en attente de validation.
          </Text>

          <View style={styles.breakdownCard} wrap={false}>
            {payload.statusBreakdown.map((item, index) => (
              <View
                key={item.label}
                style={index === payload.statusBreakdown.length - 1 ? styles.breakdownRowLast : styles.breakdownRow}
              >
                <View style={styles.breakdownHeader}>
                  <Text style={styles.breakdownLabel}>{item.label}</Text>
                  <Text style={styles.breakdownValue}>{`${item.count} (${item.percentage.toFixed(1)}%)`}</Text>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      {
                        width: `${Math.min(item.percentage, 100)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ArabSoft - Document PDF genere automatiquement depuis le tableau de bord</Text>
          <Text style={styles.footerText}>{`Responsable: ${payload.generatedByName}`}</Text>
        </View>
      </Page>
    </Document>,
  )
}
