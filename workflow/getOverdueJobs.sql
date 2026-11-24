-- Open jobs past their due date, with customer and crew
SELECT j.id, j.address, j.job_type, j.status, j.due_date,
  (current_date - j.due_date) AS days_late, j.quote_amount,
  c.name AS customer, c.phone, cr.name AS crew, cr.lead AS crew_lead
FROM jobs j
JOIN customers c ON c.id = j.customer_id
LEFT JOIN crews cr ON cr.id = j.crew_id
WHERE j.status IN ('scheduled', 'in progress')
  AND j.due_date < current_date
ORDER BY days_late DESC;
