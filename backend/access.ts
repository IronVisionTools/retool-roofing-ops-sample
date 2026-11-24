/**
 * Server-side access control. The role and crew scope are ALWAYS resolved from
 * the authenticated Retool user's email against the app_users table — never
 * trusted from client-sent params. A manager may preview the crew scope
 * (narrowing only); a crew user can never widen scope.
 */

export type Access = {
  role: 'manager' | 'crew'
  /** Set only when the effective scope is a single crew. */
  crewId: number | null
  email: string
}

type MinimalUser = { email?: string | null } | undefined | null

export async function resolveAccess(
  user: MinimalUser,
  requested?: { role?: string; crewId?: number },
): Promise<Access> {
  const email = String(user?.email ?? '')
    .trim()
    .toLowerCase()
  if (!email) throw new Error('Access denied: not signed in.')

  const res = await retoolDb.query(
    'SELECT role, crew_id FROM app_users WHERE lower(email) = $1',
    [email],
  )
  const row = res.data[0]
  if (!row) throw new Error(`Access denied: no app_users record for ${email}.`)

  if (String(row.role) === 'crew') {
    if (typeof row.crew_id !== 'number') {
      throw new Error('Access denied: crew user has no crew assigned.')
    }
    // Client-sent role/crewId are ignored entirely for crew users.
    return { role: 'crew', crewId: Number(row.crew_id), email }
  }

  // Manager: client may request a crew-scope PREVIEW (narrowing), never widening.
  if (requested?.role === 'crew' && typeof requested.crewId === 'number') {
    return { role: 'crew', crewId: requested.crewId, email }
  }
  return { role: 'manager', crewId: null, email }
}
