/**
 * AI operations assistant. Answers plain-English questions about jobs,
 * customers and crews. Access is resolved server-side from app_users: the
 * data context below is built with the SAME scoped queries as the rest of the
 * app, so the AI never receives rows or amounts outside the user's scope.
 * For crew users every amount is replaced with HIDDEN before the context
 * is built, so the model never sees a quote.
 */
import { resolveAccess } from './access'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export const retoolConfig = { timeoutSeconds: 120 }

const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const fmtDate = (d: unknown) => (d ? String(d).slice(0, 10) : '-')

export default async function (req: {
  params: { question: string; history?: ChatMessage[]; role?: string; crewId?: number }
  user: { email?: string }
}) {
  const { question, history } = req.params
  if (!question || !question.trim()) throw new Error('A question is required.')

  const access = await resolveAccess(req.user, req.params)
  const crewScoped = access.role === 'crew'
  const params = crewScoped ? [access.crewId] : []

  const jobs = await retoolDb.query(
    `SELECT j.id, j.address, j.job_type, j.status, j.scheduled_date, j.due_date,
            j.quote_amount, c.name AS customer, c.phone, c.city, cr.name AS crew
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id
     LEFT JOIN crews cr ON cr.id = j.crew_id
     ${crewScoped ? 'WHERE j.crew_id = $1' : ''}
     ORDER BY j.due_date NULLS LAST, j.id`,
    params,
  )

  const lines: string[] = []
  for (const j of jobs.data) {
    // Crew context: quote_amount is excluded by the scope, never shown or inferred.
    const amount = crewScoped ? 'HIDDEN' : fmtMoney(Number(j.quote_amount ?? 0))
    lines.push(
      [
        `Job#${j.id}`,
        j.customer,
        j.phone,
        j.city,
        j.address,
        j.job_type,
        j.status,
        `crew:${j.crew ?? 'unassigned'}`,
        `scheduled:${fmtDate(j.scheduled_date)}`,
        `due:${fmtDate(j.due_date)}`,
        `quote:${amount}`,
      ].join(' | '),
    )
  }

  const scopeNote = crewScoped
    ? 'You are supporting a CREW member. The context contains ONLY their own crew\'s jobs and every amount is HIDDEN — never guess, estimate or discuss amounts.'
    : 'You are supporting a MANAGER. All data, including quote amounts, may be shown.'

  const system = [
    'You are the operations assistant for a roofing company (internal app).',
    scopeNote,
    'Answer using ONLY the job data below. Today is ' + new Date().toISOString().slice(0, 10) + '.',
    'A job is OVERDUE when its status is not done/invoiced and its due date is before today.',
    'Be concise: short answer first, then a compact list of the matching jobs (id, customer, status, due date).',
    'Use markdown bullet points for lists. Do not invent jobs.',
  ].join('\n')

  const messages: ChatMessage[] = [
    ...(history ?? []).slice(-6),
    {
      role: 'user',
      content: `JOB DATA (${lines.length} jobs):\n${lines.join('\n')}\n\nQUESTION: ${question}`,
    },
  ]

  const result = await anthropic.chat.generate({
    messages,
    model: 'claude-sonnet-4-6',
    systemMessage: system,
    temperature: 0.2,
  })

  return { answer: result.data.queryData.data }
}
