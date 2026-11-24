/**
 * Dashboard data: KPIs + chart aggregates in a single call.
 * Access is resolved server-side from the authenticated user's app_users
 * record. Crew scope is filtered in SQL and NO amount columns are selected.
 */
import { resolveAccess } from './access'

export default async function (req: {
  params: { role?: string; crewId?: number }
  user: { email?: string }
}) {
  const access = await resolveAccess(req.user, req.params)
  const crewScoped = access.role === 'crew'
  const params = crewScoped ? [access.crewId] : []

  if (crewScoped) {
    // Crew scope: counts only — no quote_amount/revenue aggregates are queried.
    const kpis = await retoolDb.query(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('done', 'invoiced'))::int AS open_jobs,
         COUNT(*) FILTER (WHERE status NOT IN ('done', 'invoiced') AND due_date < CURRENT_DATE)::int AS overdue_jobs,
         COUNT(*) FILTER (WHERE scheduled_date >= CURRENT_DATE AND scheduled_date < CURRENT_DATE + INTERVAL '7 days')::int AS scheduled_next_7
       FROM jobs WHERE crew_id = $1`,
      params,
    )
    const byStatus = await retoolDb.query(
      'SELECT status, COUNT(*)::int AS count FROM jobs WHERE crew_id = $1 GROUP BY status',
      params,
    )
    const statusMap: Record<string, number> = {}
    for (const row of byStatus.data) statusMap[String(row.status)] = Number(row.count)
    const jobsByStatus = ['new', 'scheduled', 'in progress', 'done', 'invoiced'].map((status) => ({
      status,
      count: statusMap[status] ?? 0,
    }))

    return {
      openJobs: Number(kpis.data[0]?.open_jobs ?? 0),
      overdueJobs: Number(kpis.data[0]?.overdue_jobs ?? 0),
      revenueThisMonth: null,
      avgQuote: null,
      scheduledNext7: Number(kpis.data[0]?.scheduled_next_7 ?? 0),
      jobsByStatus,
      revenueByMonth: null,
    }
  }

  const kpis = await retoolDb.query(
    `SELECT
       COUNT(*) FILTER (WHERE status NOT IN ('done', 'invoiced'))::int AS open_jobs,
       COUNT(*) FILTER (WHERE status NOT IN ('done', 'invoiced') AND due_date < CURRENT_DATE)::int AS overdue_jobs,
       COALESCE(SUM(quote_amount) FILTER (WHERE status = 'invoiced' AND scheduled_date >= date_trunc('month', CURRENT_DATE)), 0)::float AS revenue_this_month,
       COALESCE(AVG(quote_amount), 0)::float AS avg_quote,
       COUNT(*) FILTER (WHERE scheduled_date >= CURRENT_DATE AND scheduled_date < CURRENT_DATE + INTERVAL '7 days')::int AS scheduled_next_7
     FROM jobs`,
  )

  const byStatus = await retoolDb.query(
    'SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status',
  )
  const statusMap: Record<string, number> = {}
  for (const row of byStatus.data) statusMap[String(row.status)] = Number(row.count)
  const jobsByStatus = ['new', 'scheduled', 'in progress', 'done', 'invoiced'].map((status) => ({
    status,
    count: statusMap[status] ?? 0,
  }))

  const monthly = await retoolDb.query(
    `SELECT to_char(date_trunc('month', scheduled_date), 'YYYY-MM') AS ym,
            COALESCE(SUM(quote_amount), 0)::float AS revenue
     FROM jobs
     WHERE status = 'invoiced'
       AND scheduled_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY 1`,
  )
  // Fill the last 6 months so the chart has no gaps
  const revenueMap: Record<string, number> = {}
  for (const row of monthly.data) revenueMap[String(row.ym)] = Number(row.revenue)
  const now = new Date()
  const revenueByMonth = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    revenueByMonth.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      revenue: revenueMap[ym] ?? 0,
    })
  }

  const k = kpis.data[0] ?? {}
  return {
    openJobs: Number(k.open_jobs ?? 0),
    overdueJobs: Number(k.overdue_jobs ?? 0),
    revenueThisMonth: Number(k.revenue_this_month ?? 0),
    avgQuote: Number(k.avg_quote ?? 0),
    scheduledNext7: Number(k.scheduled_next_7 ?? 0),
    jobsByStatus,
    revenueByMonth,
  }
}
