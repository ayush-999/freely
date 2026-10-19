/*
    Report A: Number of jobs received from each organization
      This query reports the number of unique jobs received from each source organization, with a government/non-government breakdown.
*/
SELECT
    o.id AS source_organization_id,
    o.name AS source_organization,
    COUNT(DISTINCT jr.job_posting_id) AS total_jobs,
    COUNT(DISTINCT CASE
        WHEN jp.job_type = 'government'
        THEN jr.job_posting_id
    END) AS government_jobs,
    COUNT(DISTINCT CASE
        WHEN jp.job_type <> 'government'
        THEN jr.job_posting_id
    END) AS other_jobs,
    MIN(jr.received_at) AS first_received_at,
    MAX(jr.received_at) AS last_received_at
FROM job_receipts jr
INNER JOIN organizations o
    ON o.id = jr.source_organization_id
INNER JOIN job_postings jp
    ON jp.id = jr.job_posting_id
WHERE jr.verification_status = 'verified'
GROUP BY o.id, o.name
ORDER BY total_jobs DESC;

/*
    Report B: When government vacancies were received
        This provides the receipt history for individual government vacancies.
*/
SELECT
    jp.id AS job_id,
    jp.title AS vacancy_title,
    gd.recruitment_name,
    gd.advertisement_number,
    source_org.name AS source_organization,
    employer.name AS recruiting_organization,
    jr.received_at,
    jr.receipt_method,
    jr.source_reference,
    jr.verification_status,
    receiver.full_name AS received_by
FROM job_receipts jr
INNER JOIN job_postings jp
    ON jp.id = jr.job_posting_id
INNER JOIN organizations source_org
    ON source_org.id = jr.source_organization_id
INNER JOIN organizations employer
    ON employer.id = jp.organization_id
LEFT JOIN government_job_details gd
    ON gd.job_id = jp.id
LEFT JOIN users receiver
    ON receiver.id = jr.received_by_user_id
WHERE jp.job_type = 'government'
ORDER BY jr.received_at DESC;

/*
    Report C: Government vacancies received by organization and month
        This report aggregates the number of government vacancies received by each source organization on a monthly basis.
*/
SELECT
    o.name AS source_organization,
    DATEFROMPARTS(
        YEAR(jr.received_at),
        MONTH(jr.received_at),
        1
    ) AS receipt_month,
    COUNT(DISTINCT jr.job_posting_id) AS government_vacancies_received
FROM job_receipts jr
INNER JOIN job_postings jp
    ON jp.id = jr.job_posting_id
INNER JOIN organizations o
    ON o.id = jr.source_organization_id
WHERE jp.job_type = 'government'
  AND jr.verification_status = 'verified'
GROUP BY
    o.name,
    DATEFROMPARTS(
        YEAR(jr.received_at),
        MONTH(jr.received_at),
        1
    )
ORDER BY receipt_month DESC, source_organization;

/*
    Report D: My applied jobs (applications submitted by the current user)
        This report lists all job applications submitted by the current user, including their status and any decisions made.
*/
DECLARE @UserId BIGINT = 123; -- Example only

SELECT
    ja.id AS application_id,
    jp.public_job_id,
    jp.title AS job_title,
    jp.job_type,
    COALESCE(o.name, employer.full_name) AS employer_name,
    ja.applied_at,
    ja.submission_status,
    ja.status AS application_status,
    d.decision_type,
    d.reason_code,
    d.candidate_message AS decision_reason,
    d.published_at AS decision_published_at
FROM dbo.job_applications ja
INNER JOIN dbo.job_postings jp
    ON jp.id = ja.job_posting_id
LEFT JOIN dbo.organizations o
    ON o.id = jp.organization_id
LEFT JOIN dbo.users employer
    ON employer.id = jp.employer_user_id
OUTER APPLY (
    SELECT TOP (1)
        jd.decision_type,
        jd.reason_code,
        jd.candidate_message,
        jd.published_at,
        jd.decision_at,
        jd.id
    FROM dbo.job_application_decisions jd
    WHERE jd.application_id = ja.id
      AND jd.published_at IS NOT NULL
    ORDER BY jd.decision_at DESC, jd.id DESC
) d
WHERE ja.applicant_user_id = @UserId
ORDER BY ja.applied_at DESC;