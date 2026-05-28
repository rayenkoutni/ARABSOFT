import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"
import {
  formatAmountTnd,
  formatFrenchDate,
  formatSalaryBreakdownPeriodLabel,
  getBonusTypeLabel,
  getAnnualBounds,
  getMonthlyBounds,
  getPayslipDownloadSlug,
  getPayslipPeriodLabel,
  parseBonusDetails,
} from "@/lib/payslip"
import { getRhSignatureDataUrl } from "@/lib/documents/signature"
import { prisma } from "@/lib/prisma"
import { PayslipPeriodType, Role } from "@prisma/client"

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png")

export interface PayslipPdfPayload {
  id: string
  period: string
  periodType: PayslipPeriodType
  periodLabel: string
  downloadSlug: string
  generatedAt: Date
  generatedDateLabel: string
  periodStart: Date
  periodEnd: Date
  baseSalary: number
  salaryOverride: number | null
  resolvedSalary: number
  bonusTotal: number
  netTotal: number
  gradeLabel: string
  employee: {
    id: string
    name: string
    email: string
    role: Role
    department: string | null
    position: string | null
    hireDate: Date
    managerId: string | null
    salaryGrade: {
      role: Role
      level: number
      baseSalary: number
    } | null
  }
  bonusDetails: ReturnType<typeof parseBonusDetails>
}

export async function getAuthorizedPayslipPdfPayload(
  payslipId: string,
  user: { id: string; role: Role },
): Promise<PayslipPdfPayload | null> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          position: true,
          hireDate: true,
          managerId: true,
          salaryGrade: {
            select: {
              role: true,
              level: true,
              baseSalary: true,
            },
          },
        },
      },
    },
  })

  if (!payslip) {
    return null
  }

  const canAccess =
    user.role === Role.RH ||
    (user.role === Role.COLLABORATEUR && payslip.employeeId === user.id) ||
    (user.role === Role.CHEF && payslip.employee.managerId === user.id)

  if (!canAccess) {
    throw new Error("FORBIDDEN")
  }

  const periodBounds = payslip.periodType === PayslipPeriodType.MONTHLY
    ? getMonthlyBounds(payslip.period)
    : getAnnualBounds(payslip.period)
  const gradeLabel = payslip.employee.salaryGrade
    ? `${payslip.employee.salaryGrade.role} - Niveau ${payslip.employee.salaryGrade.level}`
    : payslip.employee.role

  return {
    id: payslip.id,
    period: payslip.period,
    periodType: payslip.periodType,
    periodLabel: getPayslipPeriodLabel(payslip.periodType, payslip.period),
    downloadSlug: getPayslipDownloadSlug(payslip.periodType, payslip.period),
    generatedAt: payslip.generatedAt,
    generatedDateLabel: formatFrenchDate(payslip.generatedAt),
    periodStart: periodBounds.start,
    periodEnd: periodBounds.end,
    baseSalary: payslip.baseSalary,
    salaryOverride: payslip.salaryOverride,
    resolvedSalary: payslip.resolvedSalary,
    bonusTotal: payslip.bonusTotal,
    netTotal: payslip.resolvedSalary + payslip.bonusTotal,
    gradeLabel,
    employee: payslip.employee,
    bonusDetails: parseBonusDetails(payslip.bonusDetails),
  }
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingRight: 62,
    paddingBottom: 40,
    paddingLeft: 62,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  centeredHeader: {
    alignItems: "center",
    marginBottom: 18,
  },
  logo: {
    width: 165,
    height: 60,
    objectFit: "contain",
    marginBottom: 10,
  },
  brandAddress: {
    fontSize: 11,
    lineHeight: 1.3,
    color: "#4b5563",
    textAlign: "center",
  },
  headerGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 16,
  },
  headerBlock: {
    width: "48%",
  },
  headerBlockRight: {
    width: "48%",
    alignItems: "flex-end",
  },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textTransform: "uppercase",
    textDecoration: "underline",
    marginBottom: 6,
  },
  blockText: {
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#374151",
  },
  employeeBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 10,
    marginBottom: 16,
  },
  employeeTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  employeeRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  employeeLabel: {
    width: 88,
    fontSize: 10.5,
    color: "#4b5563",
  },
  employeeValue: {
    flex: 1,
    fontSize: 10.5,
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    minHeight: 28,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colRubrique: {
    width: "56%",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    fontSize: 10.5,
  },
  colBase: {
    width: "16%",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    fontSize: 10.5,
    textAlign: "center",
  },
  colAmount: {
    width: "28%",
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 10.5,
    textAlign: "right",
  },
  bold: {
    fontWeight: 700,
  },
  totalRow: {
    backgroundColor: "#fafafa",
  },
  netBox: {
    marginTop: 4,
    marginBottom: 18,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#111827",
    paddingVertical: 8,
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netLabel: {
    fontSize: 14,
    fontWeight: 700,
  },
  netValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  signatureWrap: {
    alignItems: "flex-end",
    marginBottom: 6,
  },
  signatureImage: {
    width: 150,
    height: 52,
    objectFit: "contain",
  },
  footerText: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 3,
  },
})

async function fileToDataUrl(filePath: string, mimeType: string) {
  const buffer = await readFile(filePath)
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

function truncateEmployeeId(value: string) {
  return value.slice(0, 8).toUpperCase()
}

function buildTableRows(payload: PayslipPdfPayload) {
  const rows: Array<{ rubrique: string; base: string; amount: string; bold?: boolean }> = [
    {
      rubrique: "Salaire de base",
      base: "-",
      amount: formatAmountTnd(payload.baseSalary),
    },
  ]

  if (payload.salaryOverride !== null) {
    rows.push({
      rubrique: "Salaire personnalisé",
      base: "-",
      amount: formatAmountTnd(payload.salaryOverride),
    })
  }

  if (payload.periodType === "ANNUAL") {
    for (const item of payload.bonusDetails.salaryBreakdown ?? []) {
      rows.push({
        rubrique: `${formatSalaryBreakdownPeriodLabel(item.period)} (${item.months} mois) x ${formatAmountTnd(item.salary)}`,
        base: "-",
        amount: formatAmountTnd(item.salary * item.months),
      })
    }
  }

  for (const bonus of payload.bonusDetails.bonuses) {
    rows.push({
      rubrique: `Bonus ${getBonusTypeLabel(bonus.type)}${bonus.period ? ` (${bonus.period})` : ""}`,
      base: "-",
      amount: formatAmountTnd(bonus.amount),
    })
  }

  rows.push({
    rubrique: "Total Bonus",
    base: "",
    amount: formatAmountTnd(payload.bonusTotal),
    bold: true,
  })

  return rows
}

export async function generatePayslipPdf(payload: PayslipPdfPayload) {
  const logoDataUrl = await fileToDataUrl(LOGO_PATH, "image/png")
  const signatureDataUrl = await getRhSignatureDataUrl()
  const tableRows = buildTableRows(payload)

  return renderToBuffer(
    <Document title={`ArabSoft - Fiche de Paie - ${payload.periodLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.centeredHeader}>
          <Image src={logoDataUrl} style={styles.logo} />
          <Text style={styles.brandAddress}>Centre Urbain Nord, Tunis, Tunisie</Text>
        </View>

        <View style={styles.headerGrid}>
          <View style={styles.headerBlock}>
            <Text style={styles.brandName}>ARABSOFT</Text>
            <Text style={styles.blockText}>Centre Urbain Nord, Tunis, Tunisie</Text>
            <Text style={styles.blockText}>Document RH officiel</Text>
          </View>

          <View style={styles.headerBlockRight}>
            <Text style={styles.title}>Fiche de Paie</Text>
            <Text style={styles.blockText}>
              {`Période du: ${formatFrenchDate(payload.periodStart)} au ${formatFrenchDate(payload.periodEnd)}`}
            </Text>
            <Text style={styles.blockText}>{`Paiement le: ${payload.generatedDateLabel}`}</Text>
          </View>
        </View>

        <View style={styles.employeeBox}>
          <Text style={styles.employeeTitle}>Informations employé</Text>
          <View style={styles.employeeRow}><Text style={styles.employeeLabel}>Matricule:</Text><Text style={styles.employeeValue}>{truncateEmployeeId(payload.employee.id)}</Text></View>
          <View style={styles.employeeRow}><Text style={styles.employeeLabel}>Nom:</Text><Text style={styles.employeeValue}>{payload.employee.name}</Text></View>
          <View style={styles.employeeRow}><Text style={styles.employeeLabel}>Emploi:</Text><Text style={styles.employeeValue}>{payload.employee.position || "-"}</Text></View>
          <View style={styles.employeeRow}><Text style={styles.employeeLabel}>Service:</Text><Text style={styles.employeeValue}>{payload.employee.department || "-"}</Text></View>
          <View style={styles.employeeRow}><Text style={styles.employeeLabel}>Entrée le:</Text><Text style={styles.employeeValue}>{formatFrenchDate(payload.employee.hireDate)}</Text></View>
          <View style={styles.employeeRow}><Text style={styles.employeeLabel}>Grade:</Text><Text style={styles.employeeValue}>{payload.gradeLabel}</Text></View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colRubrique}>Rubrique</Text>
            <Text style={styles.colBase}>Base</Text>
            <Text style={styles.colAmount}>Montant</Text>
          </View>

          {tableRows.map((row, index) => (
            (() => {
              const rowStyle = row.bold
                ? index === tableRows.length - 1
                  ? [styles.tableRow, styles.tableRowLast, styles.totalRow]
                  : [styles.tableRow, styles.totalRow]
                : index === tableRows.length - 1
                  ? [styles.tableRow, styles.tableRowLast]
                  : styles.tableRow
              const textStyle = row.bold ? [styles.colRubrique, styles.bold] : styles.colRubrique
              const baseStyle = row.bold ? [styles.colBase, styles.bold] : styles.colBase
              const amountStyle = row.bold ? [styles.colAmount, styles.bold] : styles.colAmount

              return (
            <View
              key={`${row.rubrique}-${index}`}
              style={rowStyle}
            >
              <Text style={textStyle}>{row.rubrique}</Text>
              <Text style={baseStyle}>{row.base || ""}</Text>
              <Text style={amountStyle}>{row.amount}</Text>
            </View>
              )
            })()
          ))}
        </View>

        <View style={styles.netBox}>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>NET A PAYER:</Text>
            <Text style={styles.netValue}>{formatAmountTnd(payload.netTotal)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.signatureWrap}>
            <Image src={signatureDataUrl} style={styles.signatureImage} />
          </View>
          <Text style={styles.footerText}>Document généré automatiquement par le système RH ArabSoft</Text>
          <Text style={styles.footerText}>{`Génération: ${formatFrenchDate(payload.generatedAt)}`}</Text>
        </View>
      </Page>
    </Document>,
  )
}
