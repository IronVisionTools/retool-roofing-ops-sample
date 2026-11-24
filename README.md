# Roofing Operations Hub: Retool sample

Backend functions and a scheduled workflow from a Retool app built for a fictional roofing company ("Summit Ridge"). The app is an operations panel with jobs, customers, a dashboard and an AI assistant, used by two kinds of people: managers and field crews. All data in the demo is fictional.

This repository contains the server-side code only (no frontend).

## Layout

- `backend/`: Retool backend functions (TypeScript)
  - `access.ts`: resolves role and crew scope for the signed-in user
  - `getViewer.ts`, `getJobs.ts`, `getCustomers.ts`, `getDashboard.ts`: reads
  - `saveJob.ts`: create / update
  - `askAssistant.ts`: AI assistant over the user's scoped job data
- `workflow/`: Daily Overdue Jobs Digest (SQL, JS, cron + webhook)
- `schema/app_users.sql`: role table used by the access layer

## Access model

- Role and crew are resolved on the server. `resolveAccess` takes the signed-in user's email and looks it up in `app_users`. A user with no row is denied.
- Role or crew sent by the client is ignored for crew users. A manager may request a crew-scoped preview, which can only narrow the view, never widen it.
- Job rows are crew-scoped inside the SQL (`WHERE crew_id = $1`), not by filtering results afterwards. Customer and crew directories stay visible to crews so they can contact the homeowner and see who leads each crew.
- In the jobs, customers and dashboard queries the amount columns (`quote_amount`, revenue, average quote) are never selected for crew users. The AI assistant masks every amount as `HIDDEN` before building its context.
- In `saveJob`, a crew user can only change `status` and `notes` on jobs of their own crew. Any other field, any other crew's job, or creating a job is rejected. The update's WHERE clause includes `crew_id`, so a cross-crew write cannot match a row.

## Workflow

The workflow in `workflow/` runs on weekdays at 07:00 America/Chicago (and via webhook), collects overdue jobs, groups them by crew, stores a record in `digest_log`, and returns the digest as JSON. A global error handler returns a 500 with a short message. See `workflow/README.md`.

## Tests run against the access layer

- Signed in as a crew user and sending `role: 'manager'` in the request still returns only that crew's 14 jobs, with no amount fields.
- As a crew user: creating a job, updating a job of another crew, changing `quote_amount`, and reassigning a job were all rejected and nothing was written.
- Crew status/notes update and a manager full update succeeded (values written back unchanged, so no data was altered).

## Notes

- The code runs inside Retool (`retoolDb` and `anthropic` are Retool-provided resources), so it is a code sample, not a standalone project.
- Demo data is fictional.
