/**
 * Create or update a job. Access is resolved server-side from app_users.
 * - Managers: full create/update.
 * - Crew: status/notes ONLY, on jobs belonging to their own crew (enforced in
 *   the SQL WHERE clause). Any attempt to touch other fields, another crew's
 *   job, or create a job is rejected with a clear error.
 */
import { resolveAccess } from './access'

type JobInput = {
  id?: number
  customer_id?: number
  address?: string
  job_type?: string
  status?: string
  crew_id?: number | null
  scheduled_date?: string | null
  quote_amount?: number | null
  due_date?: string | null
  notes?: string | null
}

type Params = { job: JobInput }

const CREW_EDITABLE = new Set(['id', 'status', 'notes'])
const VALID_STATUSES = new Set(['new', 'scheduled', 'in progress', 'done', 'invoiced'])

export default async function (req: { params: Params; user: { email?: string } }) {
  const access = await resolveAccess(req.user)
  const j = req.params.job

  if (access.role === 'crew') {
    return saveAsCrew(access.crewId as number, j)
  }
  return saveAsManager(j)
}

async function saveAsCrew(crewId: number, j: JobInput) {
  if (typeof j.id !== 'number') {
    throw new Error('Crew members cannot create jobs — contact a manager.')
  }
  // Reject any field outside status/notes, even if it matches the stored value.
  for (const key of Object.keys(j)) {
    if (!CREW_EDITABLE.has(key)) {
      throw new Error('Crew members can only update status and notes on their own jobs.')
    }
  }
  if (j.status !== undefined && !VALID_STATUSES.has(j.status)) {
    throw new Error(`Invalid status "${j.status ?? ''}".`)
  }

  const changeset: Record<string, unknown> = {}
  if (j.status !== undefined) changeset['status'] = j.status
  if (j.notes !== undefined) changeset['notes'] = j.notes
  if (Object.keys(changeset).length === 0) {
    throw new Error('Nothing to update: send a status and/or notes.')
  }

  // The crew_id predicate in the WHERE clause makes cross-crew updates impossible.
  const res = await retoolDb.updateBy({
    tableName: 'jobs',
    filterBy: [
      { key: 'id', operation: '=', value: j.id },
      { key: 'crew_id', operation: '=', value: crewId },
    ],
    changeset,
    doNotThrowOnNoOp: true,
  })
  if (!res.data.result?.[0]) {
    throw new Error('Job not found in your crew scope.')
  }
  const row = res.data.result[0] as Record<string, unknown>
  delete row.quote_amount // never echo amounts back to crew
  return { ok: true, job: row }
}

async function saveAsManager(j: JobInput) {
  if (
    typeof j.customer_id !== 'number' ||
    !j.address ||
    typeof j.job_type !== 'string' ||
    typeof j.status !== 'string'
  ) {
    throw new Error('Customer, address, job type and status are required.')
  }
  const changeset = {
    customer_id: j.customer_id,
    address: j.address,
    job_type: j.job_type,
    status: j.status,
    crew_id: j.crew_id ?? null,
    scheduled_date: j.scheduled_date || null,
    quote_amount: j.quote_amount ?? null,
    due_date: j.due_date || null,
    notes: j.notes || null,
  }

  if (typeof j.id === 'number') {
    const res = await retoolDb.updateBy({
      tableName: 'jobs',
      filterBy: [{ key: 'id', operation: '=', value: j.id }],
      changeset,
    })
    return { ok: true, job: res.data.result?.[0] ?? null }
  }

  const res = await retoolDb.insert({ tableName: 'jobs', changeset })
  return { ok: true, job: res.data.result?.[0] ?? null }
}
