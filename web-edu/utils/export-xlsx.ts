/**
 * XLSX Export Utility for Usage Analytics
 * Generates Excel files with session usage data
 */

import * as XLSX from 'xlsx'
import type { UsageSummary, UserUsage, UsageLogEntry } from '@/service/usage-analytics-api'

interface SessionExportData {
  sessionName: string
  sessionTag: string
  startDate: string
  endDate: string | null
  summary: UsageSummary[]
  userBreakdown: UserUsage[]
  userLogs: Map<string, UsageLogEntry[]> // accountId -> logs
}

/**
 * Generate and download XLSX file for session usage data
 */
export function exportSessionUsageToXlsx(data: SessionExportData): void {
  const workbook = XLSX.utils.book_new()

  // Sheet 1: Session Summary
  createSummarySheet(workbook, data)

  // Sheet 2~N: User sheets (summary + logs)
  createUserSheets(workbook, data)

  // Generate filename
  const filename = `usage-${data.sessionTag}-${new Date().toISOString().split('T')[0]}.xlsx`

  // Download
  XLSX.writeFile(workbook, filename)
}

/**
 * Create session summary sheet
 */
function createSummarySheet(workbook: XLSX.WorkBook, data: SessionExportData): void {
  const rows: (string | number)[][] = []

  // Header info
  rows.push(['세션 사용량 보고서'])
  rows.push([])
  rows.push(['세션명', data.sessionName])
  rows.push(['세션 태그', data.sessionTag])
  rows.push(['기간', `${data.startDate} ~ ${data.endDate || '진행 중'}`])
  rows.push(['생성일', new Date().toLocaleString('ko-KR')])
  rows.push([])

  // Total summary
  const totalCost = data.summary.reduce((acc, s) => acc + parseFloat(s.total_price), 0)
  const totalTokens = data.summary.reduce((acc, s) => acc + s.total_tokens, 0)
  const totalRequests = data.summary.reduce((acc, s) => acc + s.request_count, 0)

  rows.push(['[전체 요약]'])
  rows.push(['총 요청 수', totalRequests])
  rows.push(['총 토큰', totalTokens])
  rows.push(['총 비용', `$${totalCost.toFixed(4)}`])
  rows.push([])

  // Usage by type
  rows.push(['[사용 유형별]'])
  rows.push(['사용유형', '요청수', '입력토큰', '출력토큰', '총토큰', '비용'])
  data.summary.forEach((s) => {
    rows.push([
      s.usage_type,
      s.request_count,
      s.total_input_tokens,
      s.total_output_tokens,
      s.total_tokens,
      `$${parseFloat(s.total_price).toFixed(4)}`,
    ])
  })
  rows.push([])

  // User summary
  rows.push(['[사용자별 요약]'])
  rows.push(['사용자', '사용유형', '요청수', '총토큰', '비용'])

  // Group by user
  const userMap = new Map<string, { name: string; usages: UserUsage[] }>()
  data.userBreakdown.forEach((u) => {
    if (!userMap.has(u.account_id)) {
      userMap.set(u.account_id, { name: u.account_name, usages: [] })
    }
    userMap.get(u.account_id)!.usages.push(u)
  })

  userMap.forEach((userData) => {
    userData.usages.forEach((u) => {
      rows.push([userData.name, u.usage_type, u.request_count, u.total_tokens, `$${parseFloat(u.total_price).toFixed(4)}`])
    })
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]

  XLSX.utils.book_append_sheet(workbook, ws, '세션 요약')
}

/**
 * Create individual user sheets with summary and logs
 */
function createUserSheets(workbook: XLSX.WorkBook, data: SessionExportData): void {
  // Group user breakdown by account_id
  const userMap = new Map<string, { name: string; usages: UserUsage[] }>()
  data.userBreakdown.forEach((u) => {
    if (!userMap.has(u.account_id)) {
      userMap.set(u.account_id, { name: u.account_name, usages: [] })
    }
    userMap.get(u.account_id)!.usages.push(u)
  })

  userMap.forEach((userData, accountId) => {
    const rows: (string | number)[][] = []

    // User summary section
    rows.push([`사용자: ${userData.name}`])
    rows.push([])

    const totalCost = userData.usages.reduce((acc, u) => acc + parseFloat(u.total_price), 0)
    const totalTokens = userData.usages.reduce((acc, u) => acc + u.total_tokens, 0)
    const totalRequests = userData.usages.reduce((acc, u) => acc + u.request_count, 0)

    rows.push(['[요약]'])
    rows.push(['총 요청 수', totalRequests])
    rows.push(['총 토큰', totalTokens])
    rows.push(['총 비용', `$${totalCost.toFixed(4)}`])
    rows.push([])

    rows.push(['[사용 유형별]'])
    rows.push(['사용유형', '요청수', '총토큰', '비용'])
    userData.usages.forEach((u) => {
      rows.push([u.usage_type, u.request_count, u.total_tokens, `$${parseFloat(u.total_price).toFixed(4)}`])
    })
    rows.push([])

    // Logs section
    const logs = data.userLogs.get(accountId) || []
    rows.push(['[상세 로그]'])
    if (logs.length > 0) {
      rows.push(['시간', '모델', '앱', '사용유형', '입력토큰', '출력토큰', '비용'])
      logs.forEach((log) => {
        rows.push([
          new Date(log.created_at).toLocaleString('ko-KR'),
          log.model_id || '-',
          log.app_name || '-',
          log.usage_type,
          log.input_tokens,
          log.output_tokens,
          `$${parseFloat(log.total_price).toFixed(6)}`,
        ])
      })
    } else {
      rows.push(['상세 로그 없음'])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Set column widths
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]

    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = userData.name.substring(0, 31).replace(/[\\/*?[\]:]/g, '_')
    XLSX.utils.book_append_sheet(workbook, ws, sheetName)
  })
}
