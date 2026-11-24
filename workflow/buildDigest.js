// Group overdue jobs by crew and build the manager digest
const rows = getOverdueJobs.data;
if (!Array.isArray(rows)) throw new Error('getOverdueJobs did not return rows');
const byCrew = {};
for (const r of rows) {
  const crew = r.crew || 'Unassigned';
  if (!byCrew[crew]) byCrew[crew] = { crew, lead: r.crew_lead, jobs: [] };
  byCrew[crew].jobs.push(r);
}
const groups = Object.values(byCrew).sort((a, b) => b.jobs.length - a.jobs.length);
const atRisk = rows.reduce((s, r) => s + Number(r.quote_amount || 0), 0);
const text = groups.map(g => g.crew + ' (' + g.lead + '): ' + g.jobs.length + ' overdue\n' +
  g.jobs.map(j => '  #' + j.id + ' ' + j.address + ', ' + j.customer + ', ' + j.days_late + ' days late').join('\n')
).join('\n\n');
return {
  date: new Date().toISOString().slice(0, 10),
  overdueCount: rows.length,
  revenueAtRisk: Math.round(atRisk),
  crews: groups.map(g => ({ crew: g.crew, lead: g.lead, count: g.jobs.length })),
  subject: rows.length + ' overdue roofing jobs today',
  text
};
