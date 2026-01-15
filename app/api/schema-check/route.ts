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

    // Get ALL columns from InboundFunnel
    const schemaQuery = `
      SELECT column_name, data_type
      FROM \`data-analytics-306119.MarketingFunnel\`.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'InboundFunnel'
      ORDER BY column_name
    `;

    const [schemaRows] = await bigquery.query({ query: schemaQuery });

    return NextResponse.json({
      success: true,
      columnCount: schemaRows.length,
      columns: schemaRows,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
