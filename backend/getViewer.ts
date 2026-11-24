/**
 * Returns the caller's server-resolved role and crew scope.
 * The frontend uses this to render the role switch (managers only)
 * without ever being the source of truth for access.
 */
import { resolveAccess } from './access'
export default async function (req: { user: { email?: string } }) {
  const access = await resolveAccess(req.user)
  let crewName: string | null = null
  if (access.crewId !== null) {
    const crew = await retoolDb.query('SELECT name FROM crews WHERE id = $1', [access.crewId])
    crewName = (crew.data[0]?.name as string | undefined) ?? null
  }
  return { role: access.role, crewId: access.crewId, email: access.email, crewName }
}
