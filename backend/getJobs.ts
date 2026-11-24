/**
 * Jobs list joined with customer + crew info, plus lookup lists for forms.
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
  const params = crewScoped ? [access.crewId] : []

  const jobColumns = crewScoped
    ? `j.id, j.customer_id, j.address, j.job_type, j.status, j.crew_id,
       j.scheduled_date, j.due_date, j.notes`
    : `j.id, j.customer_id, j.address, j.job_type, j.status, j.crew_id,
       j.scheduled_date, j.quote_amount, j.due_date, j.notes`

  const jobs = await retoolDb.query(
    `SELECT ${jobColumns},
            c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
            cr.name AS crew_name
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     LEFT JOIN crews cr ON cr.id = j.crew_id
     ${crewScoped ? 'WHERE j.crew_id = $1' : ''}
     ORDER BY j.id DESC`,
    params,
  )
  const crews = await retoolDb.query('SELECT id, name, lead, region FROM crews ORDER BY id')
  const customers = await retoolDb.query('SELECT id, name, city FROM customers ORDER BY name')

  return { jobs: jobs.data, crews: crews.data, customers: customers.data }
}
