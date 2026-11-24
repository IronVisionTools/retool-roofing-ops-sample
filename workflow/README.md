# Daily Overdue Jobs Digest (Retool Workflow)

Builds a daily summary of overdue roofing jobs, grouped by crew, and logs each run.

## Triggers

- Cron: Monday to Friday, 07:00 America/Chicago
- Webhook (for manual or external runs)

## Block order

1. `getOverdueJobs` (SQL, `getOverdueJobs.sql`): open jobs (`scheduled` / `in progress`) with a due date before today, joined to customer and crew, most late first.
2. `buildDigest` (JavaScript, `buildDigest.js`): groups rows by crew, sorts crews by overdue count, sums `quote_amount` as revenue at risk, and builds the digest text and subject line.
3. `logDigestRun` (SQL, `logDigestRun.sql`): inserts one row into `digest_log` (`digest_log.sql`) and returns its id.
4. `returnDigest` (200 Response, `returnDigest.js`): returns `ok`, `logId`, date, counts, crews, subject and digest text as JSON.

## Error handling

`onError` is the global error handler. It returns HTTP 500 with the body in `onError.js` (`ok: false`, workflow name, failure time, a short message). The failing block is visible in the workflow's run history.
