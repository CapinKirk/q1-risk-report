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

    const results: Record<string, any> = {};

    // 0. Query RAW_2026_Plan_by_Month to see all Booking_Types with targets
    const raw2026PlanQuery = `
      SELECT DISTINCT
        Booking_Type,
        Division,
        Q1_Plan_2026,
        Q1_Actual_2025
      FROM \`data-analytics-306119.Staging.RAW_2026_Plan_by_Month\`
      WHERE Booking_Type != ''
      ORDER BY Division, Booking_Type
    `;
    try {
      const [raw2026Plan] = await bigquery.query({ query: raw2026PlanQuery });
      results.RAW_2026_Plan_by_Month_Booking_Types = raw2026Plan;
    } catch (e: any) {
      results.RAW_2026_Plan_by_Month_Booking_Types = { error: e.message };
    }

    // 0b. Check RevOpsReport distinct OpportunityTypes and Segments
    const revOpsTypesQuery = `
      SELECT DISTINCT
        RecordType,
        Region,
        OpportunityType,
        Segment
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND Period_Start_Date = '2026-01-01'
        AND RecordType IN ('POR', 'R360')
        AND Region IN ('AMER', 'EMEA', 'APAC')
      ORDER BY RecordType, Region, OpportunityType, Segment
    `;
    try {
      const [revOpsTypes] = await bigquery.query({ query: revOpsTypesQuery });
      results.RevOpsReport_OpportunityTypes_Segments = revOpsTypes;
    } catch (e: any) {
      results.RevOpsReport_OpportunityTypes_Segments = { error: e.message };
    }

    // 0c. Check OpportunityViewTable schema for Segment column
    const oppViewSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.sfdc.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'OpportunityViewTable'
        AND LOWER(column_name) LIKE '%segment%'
      ORDER BY ordinal_position
    `;
    try {
      const [oppViewSchema] = await bigquery.query({ query: oppViewSchemaQuery });
      results.OpportunityViewTable_Segment_Columns = oppViewSchema;
    } catch (e: any) {
      results.OpportunityViewTable_Segment_Columns = { error: e.message };
    }

    // 0d. Check distinct OpportunitySegment values in OpportunityViewTable
    const oppSegmentValuesQuery = `
      SELECT DISTINCT OpportunitySegment
      FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
      WHERE OpportunitySegment IS NOT NULL
      ORDER BY OpportunitySegment
    `;
    try {
      const [oppSegmentValues] = await bigquery.query({ query: oppSegmentValuesQuery });
      results.OpportunityViewTable_Segment_Values = oppSegmentValues;
    } catch (e: any) {
      results.OpportunityViewTable_Segment_Values = { error: e.message };
    }

    // 0e. Check if RevOpsReport has Source column and what distinct sources exist
    const revOpsSourceQuery = `
      SELECT DISTINCT
        RecordType,
        Source,
        ROUND(SUM(Target_MQL), 0) as total_target_mql,
        ROUND(SUM(Target_SQL), 0) as total_target_sql,
        ROUND(SUM(Target_SQO), 0) as total_target_sqo
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND Period_Start_Date = '2026-01-01'
        AND RecordType IN ('POR', 'R360')
        AND Region IN ('AMER', 'EMEA', 'APAC')
      GROUP BY RecordType, Source
      ORDER BY RecordType, Source
    `;
    try {
      const [revOpsSources] = await bigquery.query({ query: revOpsSourceQuery });
      results.RevOpsReport_Sources = revOpsSources;
    } catch (e: any) {
      results.RevOpsReport_Sources = { error: e.message };
    }

    // 1. Query FunnelStageConversion_AMER schema
    const fscAmerSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'FunnelStageConversion_AMER'
      ORDER BY ordinal_position
    `;
    const [fscAmerSchema] = await bigquery.query({ query: fscAmerSchemaQuery });
    results.FunnelStageConversion_AMER_schema = fscAmerSchema;

    // 2. Query FunnelStageConversion_AMER MIGRATION opps (uses boolean MigrationOpp column)
    const fscAmerMigrationQuery = `
      SELECT 'FSC_AMER_Migration' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18' THEN OpportunityId END) as sqo_by_qualified_date,
        COUNT(DISTINCT CASE WHEN SQO = 1 AND CreatedDate >= '2026-01-01' AND CreatedDate <= '2026-01-18' THEN OpportunityId END) as sqo_by_created_date,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as total_sqo
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_AMER\`
      WHERE MigrationOpp = true AND por_record__c = true
    `;
    try {
      const [fscAmerMigration] = await bigquery.query({ query: fscAmerMigrationQuery });
      results.FSC_AMER_Migration = fscAmerMigration;
    } catch (e: any) {
      results.FSC_AMER_Migration = { error: e.message };
    }

    // 3. Query FunnelStageConversion_AMER EXPANSION opps
    const fscAmerExpansionQuery = `
      SELECT 'FSC_AMER_Expansion' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18' THEN OpportunityId END) as sqo_by_qualified_date,
        COUNT(DISTINCT CASE WHEN SQO = 1 AND CreatedDate >= '2026-01-01' AND CreatedDate <= '2026-01-18' THEN OpportunityId END) as sqo_by_created_date,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as total_sqo
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_AMER\`
      WHERE ExpansionOpp = true AND por_record__c = true
    `;
    try {
      const [fscAmerExpansion] = await bigquery.query({ query: fscAmerExpansionQuery });
      results.FSC_AMER_Expansion = fscAmerExpansion;
    } catch (e: any) {
      results.FSC_AMER_Expansion = { error: e.message };
    }

    // 3b. Query FunnelStageConversion_APAC_EMEA schema
    const fscApacSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'FunnelStageConversion_APAC_EMEA'
      ORDER BY ordinal_position
      LIMIT 30
    `;
    try {
      const [fscApacSchema] = await bigquery.query({ query: fscApacSchemaQuery });
      results.FunnelStageConversion_APAC_EMEA_schema = fscApacSchema;
    } catch (e: any) {
      results.FunnelStageConversion_APAC_EMEA_schema = { error: e.message };
    }

    // 3c. Check if APAC_EMEA has same structure
    const fscApacMigrationQuery = `
      SELECT 'FSC_APAC_EMEA_Migration' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18' THEN OpportunityId END) as sqo_by_qualified_date,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as total_sqo
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_APAC_EMEA\`
      WHERE MigrationOpp = true AND por_record__c = true
    `;
    try {
      const [fscApacMigration] = await bigquery.query({ query: fscApacMigrationQuery });
      results.FSC_APAC_EMEA_Migration = fscApacMigration;
    } catch (e: any) {
      results.FSC_APAC_EMEA_Migration = { error: e.message };
    }

    // 4. Query NewLogoFunnel schema
    const newLogoSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'NewLogoFunnel'
      ORDER BY ordinal_position
    `;
    const [newLogoSchema] = await bigquery.query({ query: newLogoSchemaQuery });
    results.NewLogoFunnel_schema = newLogoSchema;

    // 5. Query OutboundFunnel schema
    const outboundSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'OutboundFunnel'
      ORDER BY ordinal_position
    `;
    const [outboundSchema] = await bigquery.query({ query: outboundSchemaQuery });
    results.OutboundFunnel_schema = outboundSchema;

    // 6. Query sfdc.ExpansionClosedWonLineItems schema
    const ecwliSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.sfdc.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'ExpansionClosedWonLineItems'
      ORDER BY ordinal_position
    `;
    const [ecwliSchema] = await bigquery.query({ query: ecwliSchemaQuery });
    results.ExpansionClosedWonLineItems_schema = ecwliSchema;

    // 7. ALL sources for MIGRATION SQO - comprehensive search (fixed)
    const migrationAllSourcesQuery = `
      -- FunnelStageConversion_AMER (uses MigrationOpp boolean and QualifiedDate)
      SELECT 'FSC_AMER_QualifiedDate' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_AMER\`
      WHERE MigrationOpp = true AND por_record__c = true
        AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18'

      UNION ALL

      -- FunnelStageConversion_APAC_EMEA
      SELECT 'FSC_APAC_EMEA_QualifiedDate' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_APAC_EMEA\`
      WHERE MigrationOpp = true AND por_record__c = true
        AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18'

      UNION ALL

      -- MigrationFunnel with SQO_DT
      SELECT 'MigrationFunnel_SQO_DT' as source,
        COUNT(DISTINCT CASE WHEN SQO_DT IS NOT NULL
          AND CAST(SQO_DT AS DATE) >= '2026-01-01'
          AND CAST(SQO_DT AS DATE) <= '2026-01-18'
        THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- DailyRevenueFunnel
      SELECT 'DailyRevenueFunnel' as source,
        SUM(SQO) as sqo_count
      FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
      WHERE RecordType = 'POR'
        AND UPPER(FunnelType) = 'MIGRATION'
        AND CAST(CaptureDate AS DATE) >= '2026-01-01'
        AND CAST(CaptureDate AS DATE) <= '2026-01-18'

      UNION ALL

      -- RevOpsReport
      SELECT 'RevOpsReport' as source,
        SUM(CAST(Actual_SQO AS INT64)) as sqo_count
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE RecordType = 'POR'
        AND Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND OpportunityType = 'Migration'

      UNION ALL

      -- NewLogoFunnel (checking if MIGRATION exists here)
      SELECT 'NewLogoFunnel' as source,
        COUNT(DISTINCT CASE WHEN SQO_DT IS NOT NULL
          AND CAST(SQO_DT AS DATE) >= '2026-01-01'
          AND CAST(SQO_DT AS DATE) <= '2026-01-18'
          AND UPPER(Type) LIKE '%MIGRATION%'
        THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.NewLogoFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- OutboundFunnel (checking if MIGRATION exists)
      SELECT 'OutboundFunnel' as source,
        COUNT(DISTINCT CASE WHEN SQO = 'true'
          AND CaptureDate >= '2026-01-01'
          AND CaptureDate <= '2026-01-18'
          AND UPPER(Type) LIKE '%MIGRATION%'
        THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.OutboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
    `;
    try {
      const [migrationAll] = await bigquery.query({ query: migrationAllSourcesQuery });
      results.migration_all_sources = migrationAll;
    } catch (e: any) {
      results.migration_all_sources = { error: e.message };
    }

    // 8. ALL sources for EXPANSION SQO (fixed)
    const expansionAllSourcesQuery = `
      -- FunnelStageConversion_AMER (uses ExpansionOpp boolean and QualifiedDate)
      SELECT 'FSC_AMER_QualifiedDate' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_AMER\`
      WHERE ExpansionOpp = true AND por_record__c = true
        AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18'

      UNION ALL

      -- FunnelStageConversion_APAC_EMEA
      SELECT 'FSC_APAC_EMEA_QualifiedDate' as source,
        COUNT(DISTINCT CASE WHEN SQO = 1 THEN OpportunityId END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.FunnelStageConversion_APAC_EMEA\`
      WHERE ExpansionOpp = true AND por_record__c = true
        AND QualifiedDate >= '2026-01-01' AND QualifiedDate <= '2026-01-18'

      UNION ALL

      -- ExpansionFunnel with SQO_DT
      SELECT 'ExpansionFunnel_SQO_DT' as source,
        COUNT(DISTINCT CASE WHEN SQO_DT IS NOT NULL
          AND CAST(SQO_DT AS DATE) >= '2026-01-01'
          AND CAST(SQO_DT AS DATE) <= '2026-01-18'
        THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.ExpansionFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- DailyRevenueFunnel
      SELECT 'DailyRevenueFunnel' as source,
        SUM(SQO) as sqo_count
      FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
      WHERE RecordType = 'POR'
        AND UPPER(FunnelType) = 'EXPANSION'
        AND CAST(CaptureDate AS DATE) >= '2026-01-01'
        AND CAST(CaptureDate AS DATE) <= '2026-01-18'

      UNION ALL

      -- RevOpsReport
      SELECT 'RevOpsReport' as source,
        SUM(CAST(Actual_SQO AS INT64)) as sqo_count
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE RecordType = 'POR'
        AND Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND OpportunityType = 'Existing Business'
    `;
    try {
      const [expansionAll] = await bigquery.query({ query: expansionAllSourcesQuery });
      results.expansion_all_sources = expansionAll;
    } catch (e: any) {
      results.expansion_all_sources = { error: e.message };
    }

    // 9. Check ALL distinct Types in NewLogoFunnel to see what funnel types exist
    const newLogoTypesQuery = `
      SELECT DISTINCT Type, RecordType, COUNT(*) as count
      FROM \`data-analytics-306119.MarketingFunnel.NewLogoFunnel\`
      GROUP BY Type, RecordType
      ORDER BY count DESC
    `;
    try {
      const [newLogoTypes] = await bigquery.query({ query: newLogoTypesQuery });
      results.NewLogoFunnel_types = newLogoTypes;
    } catch (e: any) {
      results.NewLogoFunnel_types = { error: e.message };
    }

    // 10. Check ExpansionFunnel vs MigrationFunnel schema differences
    const expansionFunnelSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'ExpansionFunnel'
      ORDER BY ordinal_position
      LIMIT 30
    `;
    try {
      const [expFunnelSchema] = await bigquery.query({ query: expansionFunnelSchemaQuery });
      results.ExpansionFunnel_schema = expFunnelSchema;
    } catch (e: any) {
      results.ExpansionFunnel_schema = { error: e.message };
    }

    // 11. Check MigrationFunnel schema
    const migrationFunnelSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'MigrationFunnel'
      ORDER BY ordinal_position
      LIMIT 30
    `;
    try {
      const [migFunnelSchema] = await bigquery.query({ query: migrationFunnelSchemaQuery });
      results.MigrationFunnel_schema = migFunnelSchema;
    } catch (e: any) {
      results.MigrationFunnel_schema = { error: e.message };
    }

    // 12. Look for InboundFunnel SQOs
    const inboundFunnelSqoQuery = `
      SELECT 'InboundFunnel_POR' as source,
        COUNT(DISTINCT CASE WHEN SQO_DT IS NOT NULL
          AND CAST(SQO_DT AS DATE) >= '2026-01-01'
          AND CAST(SQO_DT AS DATE) <= '2026-01-18'
        THEN COALESCE(OpportunityID, LeadId, ContactId) END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
    `;
    try {
      const [inboundSqo] = await bigquery.query({ query: inboundFunnelSqoQuery });
      results.InboundFunnel_SQO = inboundSqo;
    } catch (e: any) {
      results.InboundFunnel_SQO = { error: e.message };
    }

    // 13. Search for MIGRATION=295 with different approaches
    const migration295SearchQuery = `
      -- Using CaptureDate instead of SQO_DT (QTD)
      SELECT 'MigrationFunnel_CaptureDate_QTD' as source,
        COUNT(DISTINCT CASE WHEN CaptureDate >= '2026-01-01' AND CaptureDate <= '2026-01-18' THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- All records (no date filter)
      SELECT 'MigrationFunnel_ALL_TIME' as source,
        COUNT(DISTINCT OpportunityID) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- YTD 2025 (full year)
      SELECT 'MigrationFunnel_2025_FULL' as source,
        COUNT(DISTINCT CASE WHEN CAST(SQO_DT AS DATE) >= '2025-01-01' AND CAST(SQO_DT AS DATE) <= '2025-12-31' THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- Q4 2025
      SELECT 'MigrationFunnel_Q4_2025' as source,
        COUNT(DISTINCT CASE WHEN CAST(SQO_DT AS DATE) >= '2025-10-01' AND CAST(SQO_DT AS DATE) <= '2025-12-31' THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- Include ALL divisions (not just US/UK/AU)
      SELECT 'MigrationFunnel_ALL_DIV_QTD' as source,
        COUNT(DISTINCT CASE WHEN CAST(SQO_DT AS DATE) >= '2026-01-01' AND CAST(SQO_DT AS DATE) <= '2026-01-18' THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`

      UNION ALL

      -- DailyRevenueFunnel YTD 2025
      SELECT 'DailyRevenueFunnel_2025_FULL' as source,
        SUM(SQO) as sqo_count
      FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
      WHERE RecordType = 'POR'
        AND UPPER(FunnelType) = 'MIGRATION'
        AND CAST(CaptureDate AS DATE) >= '2025-01-01'
        AND CAST(CaptureDate AS DATE) <= '2025-12-31'

      UNION ALL

      -- RevOpsReport YTD (horizon)
      SELECT 'RevOpsReport_YTD' as source,
        SUM(CAST(Actual_SQO AS INT64)) as sqo_count
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE RecordType = 'POR'
        AND Horizon = 'YTD'
        AND RiskProfile = 'P90'
        AND OpportunityType = 'Migration'

      UNION ALL

      -- Maybe target/plan is 295, not actual?
      SELECT 'RevOpsReport_Target_QTD' as source,
        SUM(CAST(Target_SQO AS INT64)) as sqo_count
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE RecordType = 'POR'
        AND Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND OpportunityType = 'Migration'
    `;
    try {
      const [migration295] = await bigquery.query({ query: migration295SearchQuery });
      results.migration_295_search = migration295;
    } catch (e: any) {
      results.migration_295_search = { error: e.message };
    }

    // 14. Same search for EXPANSION to compare
    const expansion134SearchQuery = `
      -- Using CaptureDate instead of SQO_DT
      SELECT 'ExpansionFunnel_CaptureDate_QTD' as source,
        COUNT(DISTINCT CASE WHEN CaptureDate >= '2026-01-01' AND CaptureDate <= '2026-01-18' THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.ExpansionFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- All time
      SELECT 'ExpansionFunnel_ALL_TIME' as source,
        COUNT(DISTINCT OpportunityID) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.ExpansionFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- YTD 2025
      SELECT 'ExpansionFunnel_2025_FULL' as source,
        COUNT(DISTINCT CASE WHEN CAST(SQO_DT AS DATE) >= '2025-01-01' AND CAST(SQO_DT AS DATE) <= '2025-12-31' THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.ExpansionFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- Target instead of actual?
      SELECT 'RevOpsReport_Target_QTD' as source,
        SUM(CAST(Target_SQO AS INT64)) as sqo_count
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE RecordType = 'POR'
        AND Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND OpportunityType = 'Existing Business'
    `;
    try {
      const [expansion134] = await bigquery.query({ query: expansion134SearchQuery });
      results.expansion_134_search = expansion134;
    } catch (e: any) {
      results.expansion_134_search = { error: e.message };
    }

    // 15. List all tables in MarketingFunnel dataset to see if we're missing any
    const allTablesQuery = `
      SELECT table_name
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.TABLES\`
      ORDER BY table_name
    `;
    try {
      const [allTables] = await bigquery.query({ query: allTablesQuery });
      results.all_marketingfunnel_tables = allTables;
    } catch (e: any) {
      results.all_marketingfunnel_tables = { error: e.message };
    }

    // 16. Check Staging dataset tables too
    const stagingTablesQuery = `
      SELECT table_name
      FROM \`data-analytics-306119.Staging.INFORMATION_SCHEMA.TABLES\`
      ORDER BY table_name
    `;
    try {
      const [stagingTables] = await bigquery.query({ query: stagingTablesQuery });
      results.all_staging_tables = stagingTables;
    } catch (e: any) {
      results.all_staging_tables = { error: e.message };
    }

    // 17. Check SQOCountByMonth table for MIGRATION
    const sqoCountByMonthQuery = `
      SELECT 'SQOCountByMonth' as source, *
      FROM \`data-analytics-306119.MarketingFunnel.SQOCountByMonth\`
      WHERE UPPER(FunnelType) LIKE '%MIGRATION%' OR UPPER(Category) LIKE '%MIGRATION%'
      LIMIT 10
    `;
    try {
      const [sqoMonth] = await bigquery.query({ query: sqoCountByMonthQuery });
      results.SQOCountByMonth_migration = sqoMonth;
    } catch (e: any) {
      results.SQOCountByMonth_migration = { error: e.message };
    }

    // 18. Check MonthlyRevenueFunnel
    const monthlyFunnelQuery = `
      SELECT 'MonthlyRevenueFunnel' as source, *
      FROM \`data-analytics-306119.Staging.MonthlyRevenueFunnel\`
      WHERE RecordType = 'POR' AND UPPER(FunnelType) = 'MIGRATION'
      ORDER BY CaptureDate DESC
      LIMIT 15
    `;
    try {
      const [monthlyFunnel] = await bigquery.query({ query: monthlyFunnelQuery });
      results.MonthlyRevenueFunnel_migration = monthlyFunnel;
    } catch (e: any) {
      results.MonthlyRevenueFunnel_migration = { error: e.message };
    }

    // 19. Check ClosedLostFunnel schema
    const closedLostSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'ClosedLostFunnel'
      LIMIT 20
    `;
    try {
      const [closedLostSchema] = await bigquery.query({ query: closedLostSchemaQuery });
      results.ClosedLostFunnel_schema = closedLostSchema;
    } catch (e: any) {
      results.ClosedLostFunnel_schema = { error: e.message };
    }

    // 20. Check if 295 might be a MTD or specific date range value
    const migrationMTDQuery = `
      -- MTD from RevOpsReport
      SELECT 'RevOpsReport_MTD' as source,
        SUM(CAST(Actual_SQO AS INT64)) as sqo_count
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE RecordType = 'POR'
        AND Horizon = 'MTD'
        AND RiskProfile = 'P90'
        AND OpportunityType = 'Migration'

      UNION ALL

      -- Last 30 days
      SELECT 'MigrationFunnel_Last30Days' as source,
        COUNT(DISTINCT CASE WHEN CAST(SQO_DT AS DATE) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- Last 90 days
      SELECT 'MigrationFunnel_Last90Days' as source,
        COUNT(DISTINCT CASE WHEN CAST(SQO_DT AS DATE) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY) THEN OpportunityID END) as sqo_count
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')

      UNION ALL

      -- Including R360 Migration
      SELECT 'DailyRevenueFunnel_R360_MIGRATION_QTD' as source,
        SUM(SQO) as sqo_count
      FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
      WHERE UPPER(FunnelType) LIKE '%MIGRATION%'
        AND CAST(CaptureDate AS DATE) >= '2026-01-01'
        AND CAST(CaptureDate AS DATE) <= '2026-01-18'

      UNION ALL

      -- ALL products migration
      SELECT 'DailyRevenueFunnel_ALL_MIGRATION_QTD' as source,
        SUM(SQO) as sqo_count
      FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
      WHERE UPPER(FunnelType) = 'MIGRATION'
        AND CAST(CaptureDate AS DATE) >= '2026-01-01'
        AND CAST(CaptureDate AS DATE) <= '2026-01-18'
    `;
    try {
      const [migrationMTD] = await bigquery.query({ query: migrationMTDQuery });
      results.migration_mtd_search = migrationMTD;
    } catch (e: any) {
      results.migration_mtd_search = { error: e.message };
    }

    // 21. Check BookingsPlan2026 for MIGRATION targets
    const bookingsPlanQuery = `
      SELECT *
      FROM \`data-analytics-306119.Staging.BookingsPlan2026\`
      WHERE UPPER(OpportunityType) LIKE '%MIGRATION%'
      LIMIT 10
    `;
    try {
      const [bookingsPlan] = await bigquery.query({ query: bookingsPlanQuery });
      results.BookingsPlan2026_migration = bookingsPlan;
    } catch (e: any) {
      results.BookingsPlan2026_migration = { error: e.message };
    }

    // 22. Count all SQOs by FunnelType in DailyRevenueFunnel QTD
    const allFunnelTypesQuery = `
      SELECT
        RecordType,
        FunnelType,
        SUM(SQO) as sqo_count
      FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
      WHERE CAST(CaptureDate AS DATE) >= '2026-01-01'
        AND CAST(CaptureDate AS DATE) <= '2026-01-18'
      GROUP BY RecordType, FunnelType
      ORDER BY sqo_count DESC
    `;
    try {
      const [allFunnelTypes] = await bigquery.query({ query: allFunnelTypesQuery });
      results.DailyRevenueFunnel_all_types_QTD = allFunnelTypes;
    } catch (e: any) {
      results.DailyRevenueFunnel_all_types_QTD = { error: e.message };
    }

    // UTM Field Coverage Analysis in InboundFunnel - check actual distinct values
    const utmCoverageQuery = `
      SELECT
        'InboundFunnel' AS table_name,
        COUNT(*) AS total_records,
        COUNTIF(UtmSource IS NOT NULL AND UtmSource != '' AND UtmSource != 'null' AND UtmSource != 'undefined') AS has_real_utm_source,
        COUNTIF(UtmMedium IS NOT NULL AND UtmMedium != '' AND UtmMedium != 'null' AND UtmMedium != 'undefined') AS has_real_utm_medium,
        COUNTIF(UtmTerm IS NOT NULL AND UtmTerm != '' AND UtmTerm != 'null' AND UtmTerm != 'undefined') AS has_real_utm_term
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND MQL_DT IS NOT NULL
        AND CAST(MQL_DT AS DATE) >= '2026-01-01'
    `;

    // Get distinct UTM values to see what's actually there
    const utmDistinctValuesQuery = `
      SELECT
        UtmSource AS utm_source,
        UtmMedium AS utm_medium,
        COUNT(*) AS record_count
      FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND MQL_DT IS NOT NULL
        AND CAST(MQL_DT AS DATE) >= '2026-01-01'
      GROUP BY UtmSource, UtmMedium
      ORDER BY record_count DESC
      LIMIT 20
    `;
    try {
      const [utmCoverage] = await bigquery.query({ query: utmCoverageQuery });
      results.InboundFunnel_UTM_Coverage = utmCoverage;
    } catch (e: any) {
      results.InboundFunnel_UTM_Coverage = { error: e.message };
    }

    try {
      const [utmDistinct] = await bigquery.query({ query: utmDistinctValuesQuery });
      results.InboundFunnel_UTM_Distinct_Values = utmDistinct;
    } catch (e: any) {
      results.InboundFunnel_UTM_Distinct_Values = { error: e.message };
    }

    // Check LeadContactMQL table schema for UTM fields
    const leadContactMqlSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'LeadContactMQL'
        AND LOWER(column_name) LIKE '%utm%'
      ORDER BY ordinal_position
    `;
    try {
      const [leadContactMqlSchema] = await bigquery.query({ query: leadContactMqlSchemaQuery });
      results.LeadContactMQL_UTM_Columns = leadContactMqlSchema;
    } catch (e: any) {
      results.LeadContactMQL_UTM_Columns = { error: e.message };
    }

    // Check InboundLeads table schema for UTM fields
    const inboundLeadsSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'InboundLeads'
        AND LOWER(column_name) LIKE '%utm%'
      ORDER BY ordinal_position
    `;
    try {
      const [inboundLeadsSchema] = await bigquery.query({ query: inboundLeadsSchemaQuery });
      results.InboundLeads_UTM_Columns = inboundLeadsSchema;
    } catch (e: any) {
      results.InboundLeads_UTM_Columns = { error: e.message };
    }

    // Check sfdc LeadViewTable for UTM fields
    const leadViewTableSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.sfdc.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'LeadViewTable'
        AND (LOWER(column_name) LIKE '%utm%' OR LOWER(column_name) LIKE '%source%' OR LOWER(column_name) LIKE '%medium%')
      ORDER BY ordinal_position
    `;
    try {
      const [leadViewTableSchema] = await bigquery.query({ query: leadViewTableSchemaQuery });
      results.LeadViewTable_UTM_Columns = leadViewTableSchema;
    } catch (e: any) {
      results.LeadViewTable_UTM_Columns = { error: e.message };
    }

    // Check sfdc.Case table schema for UTM fields
    const caseSchemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.sfdc.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'Case'
        AND (LOWER(column_name) LIKE '%utm%' OR LOWER(column_name) LIKE '%source%' OR column_name = 'Id')
      ORDER BY ordinal_position
    `;
    try {
      const [caseSchema] = await bigquery.query({ query: caseSchemaQuery });
      results.Case_UTM_Columns = caseSchema;
    } catch (e: any) {
      results.Case_UTM_Columns = { error: e.message };
    }

    // Check MigrationFunnel for MigrationCase column and sample data
    const migrationCaseQuery = `
      SELECT
        OpportunityID,
        MigrationCase,
        Division,
        EQL_DT
      FROM \`data-analytics-306119.MarketingFunnel.MigrationFunnel\`
      WHERE MigrationCase IS NOT NULL
        AND Division IN ('US', 'UK', 'AU')
      LIMIT 10
    `;
    try {
      const [migrationCaseData] = await bigquery.query({ query: migrationCaseQuery });
      results.MigrationFunnel_CaseLinks = migrationCaseData;
    } catch (e: any) {
      results.MigrationFunnel_CaseLinks = { error: e.message };
    }

    // Sample Case data with UTM_Source__c
    const caseSampleQuery = `
      SELECT
        Id,
        CaseNumber,
        UTM_Source__c,
        Status,
        Type
      FROM \`data-analytics-306119.sfdc.Case\`
      WHERE UTM_Source__c IS NOT NULL
      LIMIT 10
    `;
    try {
      const [caseSample] = await bigquery.query({ query: caseSampleQuery });
      results.Case_UTM_Sample = caseSample;
    } catch (e: any) {
      results.Case_UTM_Sample = { error: e.message };
    }

    // Check Opportunity table for Case-related columns
    const oppCaseColumnsQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.sfdc.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'Opportunity'
        AND (LOWER(column_name) LIKE '%case%' OR LOWER(column_name) LIKE '%migration%')
      ORDER BY ordinal_position
    `;
    try {
      const [oppCaseColumns] = await bigquery.query({ query: oppCaseColumnsQuery });
      results.Opportunity_Case_Columns = oppCaseColumns;
    } catch (e: any) {
      results.Opportunity_Case_Columns = { error: e.message };
    }

    // Sample Opportunity to Case link via inside_sales_case__c
    const oppToCaseQuery = `
      SELECT
        o.Id AS opp_id,
        o.Name AS opp_name,
        o.Type,
        o.inside_sales_case__c,
        o.migration_id__c,
        c.Id AS case_id,
        c.CaseNumber,
        c.UTM_Source__c,
        c.utm_medium__c,
        c.utm_campaign__c
      FROM \`data-analytics-306119.sfdc.Opportunity\` o
      LEFT JOIN \`data-analytics-306119.sfdc.Case\` c ON o.inside_sales_case__c = c.Id
      WHERE o.Type IN ('Existing Business', 'Migration')
        AND o.CreatedDate >= '2026-01-01'
        AND o.inside_sales_case__c IS NOT NULL
      LIMIT 20
    `;
    try {
      const [oppToCase] = await bigquery.query({ query: oppToCaseQuery });
      results.Opportunity_To_Case_Sample = oppToCase;
    } catch (e: any) {
      results.Opportunity_To_Case_Sample = { error: e.message };
    }

    // Count EQLs with/without Case link
    const eqlCaseCoverageQuery = `
      SELECT
        o.Type,
        COUNT(*) AS total_eqls,
        COUNTIF(o.inside_sales_case__c IS NOT NULL) AS with_case_link,
        COUNTIF(c.UTM_Source__c IS NOT NULL) AS with_utm_source
      FROM \`data-analytics-306119.sfdc.Opportunity\` o
      LEFT JOIN \`data-analytics-306119.sfdc.Case\` c ON o.inside_sales_case__c = c.Id
      WHERE o.Type IN ('Existing Business', 'Migration')
        AND o.CreatedDate >= '2026-01-01'
      GROUP BY o.Type
    `;
    try {
      const [eqlCoverage] = await bigquery.query({ query: eqlCaseCoverageQuery });
      results.EQL_Case_UTM_Coverage = eqlCoverage;
    } catch (e: any) {
      results.EQL_Case_UTM_Coverage = { error: e.message };
    }

    // Check RevOpsReport Q1 targets breakdown
    const revOpsQ1TargetsQuery = `
      SELECT
        RecordType,
        Region,
        OpportunityType,
        SUM(Target_ACV) AS q1_target_acv
      FROM \`data-analytics-306119.Staging.RevOpsReport\`
      WHERE Horizon = 'QTD'
        AND RiskProfile = 'P90'
        AND Period_Start_Date = '2026-01-01'
        AND RecordType IN ('POR', 'R360')
        AND Region IN ('AMER', 'EMEA', 'APAC')
      GROUP BY RecordType, Region, OpportunityType
      ORDER BY RecordType, Region, OpportunityType
    `;
    try {
      const [revOpsQ1Targets] = await bigquery.query({ query: revOpsQ1TargetsQuery });
      results.RevOpsReport_Q1_Targets = revOpsQ1Targets;
    } catch (e: any) {
      results.RevOpsReport_Q1_Targets = { error: e.message };
    }

    // Check RAW_2026_Plan_by_Month data
    const raw2026ByMonthQuery = `
      SELECT
        Division,
        Booking_Type,
        Q1_Plan_2026
      FROM \`data-analytics-306119.Staging.RAW_2026_Plan_by_Month\`
      WHERE Division IS NOT NULL
        AND Booking_Type IS NOT NULL
      ORDER BY Division, Booking_Type
    `;
    try {
      const [raw2026ByMonth] = await bigquery.query({ query: raw2026ByMonthQuery });
      results.RAW_2026_Plan_by_Month = raw2026ByMonth;
    } catch (e: any) {
      results.RAW_2026_Plan_by_Month = { error: e.message };
    }

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}
