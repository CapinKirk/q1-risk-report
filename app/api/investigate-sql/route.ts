import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export async function GET() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'data-analytics-306119';

  try {
    let bigquery: BigQuery;

    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      bigquery = new BigQuery({ projectId, credentials });
    } else {
      bigquery = new BigQuery({ projectId });
    }

    // First, check what columns exist in InboundFunnel
    const schemaQuery = `
      SELECT column_name
      FROM \`data-analytics-306119.MarketingFunnel\`.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'InboundFunnel'
        AND (
          LOWER(column_name) LIKE '%delete%'
          OR LOWER(column_name) LIKE '%convert%'
          OR LOWER(column_name) LIKE '%status%'
          OR LOWER(column_name) LIKE '%disq%'
          OR LOWER(column_name) LIKE '%revert%'
          OR LOWER(column_name) LIKE '%opp%'
          OR LOWER(column_name) LIKE '%reason%'
        )
      ORDER BY column_name
    `;

    const [schemaRows] = await bigquery.query({ query: schemaQuery });

    // Query SQLs without opportunities - get all available fields
    const investigateQuery = `
      SELECT
        COALESCE(Company, 'Unknown') AS company_name,
        Division,
        SDRSource AS source,
        CAST(SQL_DT AS STRING) AS sql_date,
        CAST(MQL_DT AS STRING) AS mql_date,
        CAST(SAL_DT AS STRING) AS sal_date,
        CAST(SQO_DT AS STRING) AS sqo_date,
        OpportunityID,
        OpportunityName,
        LeadId,
        ContactId,
        Status,
        IsDeleted,
        IsConverted,
        ConvertedDate,
        DisqualificationReason,
        MQL_Reverted,
        DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) AS days_since_sql
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
        AND SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= '2026-01-01'
        AND CAST(SQL_DT AS DATE) <= '2026-01-15'
        AND (OpportunityID IS NULL OR OpportunityID = '')
      ORDER BY SQL_DT DESC
    `;

    const [noOppRows] = await bigquery.query({ query: investigateQuery });

    // Also get summary stats by Status field
    const statsQuery = `
      SELECT
        CASE WHEN OpportunityID IS NULL OR OpportunityID = '' THEN 'No Opp' ELSE 'Has Opp' END AS opp_status,
        Status,
        IsDeleted,
        IsConverted,
        COUNT(*) AS count
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
        AND SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= '2026-01-01'
        AND CAST(SQL_DT AS DATE) <= '2026-01-15'
      GROUP BY opp_status, Status, IsDeleted, IsConverted
      ORDER BY opp_status, count DESC
    `;

    const [statsRows] = await bigquery.query({ query: statsQuery });

    // Check sources breakdown
    const sourceQuery = `
      SELECT
        CASE WHEN OpportunityID IS NULL OR OpportunityID = '' THEN 'No Opp' ELSE 'Has Opp' END AS opp_status,
        SDRSource,
        COUNT(*) AS count
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
        AND SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= '2026-01-01'
        AND CAST(SQL_DT AS DATE) <= '2026-01-15'
      GROUP BY opp_status, SDRSource
      ORDER BY opp_status, count DESC
    `;

    const [sourceRows] = await bigquery.query({ query: sourceQuery });

    // Check days since SQL
    const ageQuery = `
      SELECT
        CASE WHEN OpportunityID IS NULL OR OpportunityID = '' THEN 'No Opp' ELSE 'Has Opp' END AS opp_status,
        AVG(DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY)) AS avg_days_since_sql,
        MIN(DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY)) AS min_days,
        MAX(DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY)) AS max_days
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
        AND SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= '2026-01-01'
        AND CAST(SQL_DT AS DATE) <= '2026-01-15'
      GROUP BY opp_status
    `;

    const [ageRows] = await bigquery.query({ query: ageQuery });

    return NextResponse.json({
      success: true,
      availableColumns: schemaRows,
      noOppRecords: noOppRows,
      statusBreakdown: statsRows,
      sourceBreakdown: sourceRows,
      ageBreakdown: ageRows,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
