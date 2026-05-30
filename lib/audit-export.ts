import type { Prisma } from "@prisma/client"

export interface AuditLogExportFilters {
  entity?: string | null
  search?: string | null
}

export function buildAuditLogWhere(filters: AuditLogExportFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {}

  if (filters.entity) {
    where.entity = filters.entity
  }

  if (filters.search) {
    where.actorName = {
      contains: filters.search,
      mode: "insensitive",
    }
  }

  return where
}

export function formatAuditLogDetails(details: string | null): string {
  if (!details) return "-"

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>

    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ")
  } catch {
    return details
  }
}

function escapeSpreadsheetValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function createCell(value: string, styleId: string): string {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeSpreadsheetValue(value)}</Data></Cell>`
}

export function generateAuditLogsExcelXml(
  logs: Array<{
    createdAt: Date
    actorName: string
    action: string
    entity: string
    entityId: string
    details: string | null
  }>
): string {
  const rows = logs
    .map((log, index) => {
      const values = [
        log.createdAt.toLocaleString("fr-FR"),
        log.actorName,
        log.action,
        log.entity,
        log.entityId,
        formatAuditLogDetails(log.details),
      ]
      const rowStyle = index % 2 === 0 ? "DataRowLight" : "DataRowAlt"

      const cells = values
        .map((value) => {
          return createCell(value, rowStyle)
        })
        .join("")

      return `<Row ss:AutoFitHeight="0" ss:Height="24">${cells}</Row>`
    })
    .join("")

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>ARABSOFT HR Portal</Author>
  <LastAuthor>ARABSOFT HR Portal</LastAuthor>
  <Created>${new Date().toISOString()}</Created>
  <Company>ARABSOFT</Company>
  <Version>16.00</Version>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderRow">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#112238"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#112238"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#112238"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#112238"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0A1628" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowLight">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowAlt">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Journal audit">
  <Table ss:DefaultRowHeight="24">
   <Column ss:AutoFitWidth="0" ss:Width="120"/>
   <Column ss:AutoFitWidth="0" ss:Width="135"/>
   <Column ss:AutoFitWidth="0" ss:Width="120"/>
   <Column ss:AutoFitWidth="0" ss:Width="110"/>
   <Column ss:AutoFitWidth="0" ss:Width="220"/>
   <Column ss:AutoFitWidth="0" ss:Width="340"/>
   <Row ss:StyleID="HeaderRow" ss:AutoFitHeight="0" ss:Height="28">
    ${createCell("Date", "HeaderRow")}
    ${createCell("Acteur", "HeaderRow")}
    ${createCell("Action", "HeaderRow")}
    ${createCell("Entite", "HeaderRow")}
    ${createCell("Identifiant", "HeaderRow")}
    ${createCell("Details", "HeaderRow")}
   </Row>
   ${rows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
   <Panes>
    <Pane>
     <Number>2</Number>
     <ActiveRow>1</ActiveRow>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`
}
