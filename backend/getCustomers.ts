/**
 * Customers with their job history attached.
 * Access is resolved server-side from app_users. Crew scope filters in SQL
 * (WHERE j.crew_id = $1) and quote_amount is NOT selected at all.
 */
import { resolveAccess } from './access'

export default async function (req: {
  params: { role?: string; crewId?: number }
  user: { email?: string }
}) {
  const access = await resolveAccess(req.user, req.params)
  const crewScoped = access.role === 'crew'

  const customers = await retoolDb.query(
    'SELECT id, name, phone, email, city FROM customers ORDER BY name',
  )
  const jobs = await retoolDb.query(
    `SELECT j.id, j.customer_id, j.address, j.job_type, j.status, j.crew_id,
            j.scheduled_date, j.due_date,${crewScoped ? '' : '\n            j.quote_amount,'}
            cr.name AS crew_name
     FROM jobs j
     LEFT JOIN crews cr ON cr.id = j.crew_id
     ${crewScoped ? 'WHERE j.crew_id = $1' : ''}
     ORDER BY j.scheduled_date DESC NULLS LAST, j.id DESC`,
    crewScoped ? [access.crewId] : [],
  )

  const byCustomer: Record<number, unknown[]> = {}
  for (const job of jobs.data) {
    const key = Number(job.customer_id)
    if (!byCustomer[key]) byCustomer[key] = []
    byCustomer[key].push(job)
  }

  return {
    customers: customers.data.map((c) => ({
      ...c,
      jobs: byCustomer[Number(c.id)] ?? [],
    })),
  }
}
