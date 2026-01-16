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
        LeadID,
        ContactID,
        Status,
        UnqualifiedReason,
        MQL_Reverted,
        Won,
        WonACV,
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
        Won,
        COUNT(*) AS count
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
        AND SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= '2026-01-01'
        AND CAST(SQL_DT AS DATE) <= '2026-01-15'
      GROUP BY opp_status, Status, Won
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

    // NEW: Check if orphaned SQL records have matching opportunities in Salesforce
    // Matches by Company name (AccountName) since ContactID is typically NULL
    const matchCheckQuery = `
      WITH orphaned_sqls AS (
        SELECT DISTINCT
          f.LeadID,
          f.ContactID,
          COALESCE(f.LeadEmail, f.ContactEmail) AS email,
          f.Company,
          f.Division,
          CAST(f.SQL_DT AS DATE) AS sql_date,
          CAST(f.SAL_DT AS DATE) AS sal_date,
          CAST(f.SQO_DT AS DATE) AS sqo_date,
          CASE
            WHEN f.SQO_DT IS NOT NULL THEN 'SQO'
            WHEN f.SAL_DT IS NOT NULL THEN 'SAL'
            WHEN f.SQL_DT IS NOT NULL THEN 'SQL'
          END AS furthest_stage
        FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\` f
        WHERE f.Division IN ('US', 'UK', 'AU')
          AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
          AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
          AND f.SQL_DT IS NOT NULL
          AND CAST(f.SQL_DT AS DATE) >= '2026-01-01'
          AND CAST(f.SQL_DT AS DATE) <= '2026-01-15'
          AND (f.OpportunityID IS NULL OR f.OpportunityID = '')
      ),
      opportunities AS (
        SELECT
          o.Id AS opp_id,
          o.OpportunityName AS opp_name,
          o.contactid,
          o.AccountName,
          o.Division,
          o.Type,
          o.StageName,
          o.ACV,
          o.Won,
          o.CloseDate,
          CAST(o.CreatedDate AS DATE) AS created_date
        FROM \`data-analytics-306119.sfdc.OpportunityViewTable\` o
        WHERE o.por_record__c = true
          AND o.Division IN ('US', 'UK', 'AU')
      ),
      -- Match by Company name (AccountName)
      matched AS (
        SELECT
          s.*,
          o.opp_id,
          o.opp_name,
          o.AccountName AS matched_account,
          o.Type AS matched_type,
          o.StageName AS matched_stage,
          o.ACV AS matched_acv,
          o.Won AS matched_won,
          o.CloseDate AS matched_close_date,
          CASE
            WHEN o.opp_id IS NOT NULL THEN 'MATCH_FOUND'
            ELSE 'NO_MATCH'
          END AS match_status
        FROM orphaned_sqls s
        LEFT JOIN opportunities o
          ON LOWER(TRIM(s.Company)) = LOWER(TRIM(o.AccountName))
          AND s.Division = o.Division
      )
      SELECT
        furthest_stage,
        COUNT(DISTINCT Company) AS total_orphaned,
        COUNT(DISTINCT CASE WHEN match_status = 'MATCH_FOUND' THEN Company END) AS matches_found,
        COUNT(DISTINCT CASE WHEN match_status = 'NO_MATCH' THEN Company END) AS truly_orphaned,
        ROUND(SAFE_DIVIDE(
          COUNT(DISTINCT CASE WHEN match_status = 'MATCH_FOUND' THEN Company END),
          COUNT(DISTINCT Company)
        ) * 100, 1) AS match_rate_pct
      FROM matched
      GROUP BY furthest_stage
      ORDER BY CASE furthest_stage WHEN 'SQL' THEN 1 WHEN 'SAL' THEN 2 WHEN 'SQO' THEN 3 END
    `;

    const [matchRows] = await bigquery.query({ query: matchCheckQuery });

    // Get detailed match results for manual inspection
    const matchDetailQuery = `
      WITH orphaned_sqls AS (
        SELECT DISTINCT
          f.LeadID,
          f.ContactID,
          COALESCE(f.LeadEmail, f.ContactEmail) AS email,
          f.Company,
          f.Division,
          CAST(f.SQL_DT AS DATE) AS sql_date,
          CAST(f.SAL_DT AS DATE) AS sal_date,
          CAST(f.SQO_DT AS DATE) AS sqo_date,
          CASE
            WHEN f.SQO_DT IS NOT NULL THEN 'SQO'
            WHEN f.SAL_DT IS NOT NULL THEN 'SAL'
            WHEN f.SQL_DT IS NOT NULL THEN 'SQL'
          END AS furthest_stage
        FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\` f
        WHERE f.Division IN ('US', 'UK', 'AU')
          AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
          AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
          AND f.SQL_DT IS NOT NULL
          AND CAST(f.SQL_DT AS DATE) >= '2026-01-01'
          AND CAST(f.SQL_DT AS DATE) <= '2026-01-15'
          AND (f.OpportunityID IS NULL OR f.OpportunityID = '')
      ),
      opportunities AS (
        SELECT
          o.Id AS opp_id,
          o.OpportunityName AS opp_name,
          o.contactid,
          o.AccountName,
          o.Division,
          o.Type,
          o.StageName,
          o.ACV,
          o.Won,
          o.CloseDate
        FROM \`data-analytics-306119.sfdc.OpportunityViewTable\` o
        WHERE o.por_record__c = true
          AND o.Division IN ('US', 'UK', 'AU')
      )
      SELECT
        s.Company,
        s.email,
        s.Division,
        s.sql_date,
        s.sal_date,
        s.sqo_date,
        s.furthest_stage,
        o.opp_id AS matched_opp_id,
        o.opp_name AS matched_opp_name,
        o.AccountName AS matched_account,
        o.Type AS matched_type,
        o.StageName AS matched_stage,
        o.ACV AS matched_acv,
        o.Won AS matched_won,
        CASE
          WHEN o.opp_id IS NOT NULL THEN 'MATCH_FOUND'
          ELSE 'NO_MATCH'
        END AS match_status
      FROM orphaned_sqls s
      LEFT JOIN opportunities o
        ON LOWER(TRIM(s.Company)) = LOWER(TRIM(o.AccountName))
        AND s.Division = o.Division
      ORDER BY s.furthest_stage DESC, s.sql_date DESC
    `;

    const [matchDetailRows] = await bigquery.query({ query: matchDetailQuery });

    return NextResponse.json({
      success: true,
      availableColumns: schemaRows,
      noOppRecords: noOppRows,
      statusBreakdown: statsRows,
      sourceBreakdown: sourceRows,
      ageBreakdown: ageRows,
      matchSummary: matchRows,
      matchDetails: matchDetailRows,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
