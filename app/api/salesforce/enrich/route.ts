/**
 * Salesforce Data Enrichment API
 *
 * Queries Salesforce directly using the user's OAuth token to fill in
 * missing data (ACV, Stage, etc.) for specific opportunity IDs.
 *
 * This is used as a waterfall fallback when BigQuery data is incomplete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getSalesforceTokens } from '@/lib/auth';
import jsforce from 'jsforce';

interface EnrichRequest {
  opportunityIds: string[];
  fields?: string[];
}

interface EnrichedOpportunity {
  Id: string;
  Name: string;
  ACV__c?: number;
  StageName?: string;
  IsClosed?: boolean;
  IsWon?: boolean;
  Amount?: number;
  CloseDate?: string;
  AccountName?: string;
  ClosedLostReason__c?: string;
}

// Default fields to fetch
const DEFAULT_FIELDS = [
  'Id',
  'Name',
  'ACV__c',
  'StageName',
  'IsClosed',
  'IsWon',
  'Amount',
  'CloseDate',
  'Account.Name',
  'ClosedLostReason__c',
];

export async function POST(request: NextRequest) {
  try {
    // Check for test bypass header (for E2E testing)
    const testBypass = request.headers.get('x-playwright-test');
    const testSecret = process.env.PLAYWRIGHT_TEST_SECRET;
    const isTestMode = !!(testSecret && testBypass === testSecret);

    // Get session and check for SF tokens
    const session = await getServerSession(authOptions);

    if (!session && !isTestMode) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sfTokens = getSalesforceTokens(session);

    if (!sfTokens && !isTestMode) {
      return NextResponse.json(
        {
          error: 'Salesforce not connected',
          message: 'Please connect your Salesforce account to enable data enrichment',
          requiresConnection: true,
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body: EnrichRequest = await request.json();
    const { opportunityIds, fields } = body;

    if (!opportunityIds || !Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return NextResponse.json(
        { error: 'opportunityIds array is required' },
        { status: 400 }
      );
    }

    // Limit to 200 IDs per request to avoid SOQL limits
    if (opportunityIds.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 opportunity IDs per request' },
        { status: 400 }
      );
    }

    // Validate fields against allowlist to prevent SOQL injection
    const ALLOWED_FIELDS = new Set(DEFAULT_FIELDS);
    const safeFields = (Array.isArray(fields) ? fields : [])
      .filter((f: unknown): f is string => typeof f === 'string' && ALLOWED_FIELDS.has(f));
    const validatedFields = safeFields.length > 0 ? safeFields : DEFAULT_FIELDS;

    // Validate opportunity IDs — must be 15 or 18 char alphanumeric Salesforce IDs
    const sfIdRegex = /^[a-zA-Z0-9]{15,18}$/;
    const safeIds = opportunityIds.filter((id: unknown): id is string =>
      typeof id === 'string' && sfIdRegex.test(id)
    );
    if (safeIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid Salesforce IDs provided' },
        { status: 400 }
      );
    }

    // In test mode, return mock data
    if (isTestMode && !sfTokens) {
      const mockData = opportunityIds.map(id => ({
        Id: id,
        Name: `Mock Opportunity ${id.slice(-4)}`,
        ACV__c: Math.round(Math.random() * 50000),
        StageName: 'Closed Won',
        IsClosed: true,
        IsWon: true,
      }));

      return NextResponse.json({
        success: true,
        data: mockData,
        source: 'mock',
      });
    }

    // Create Salesforce connection with user's token
    const conn = new jsforce.Connection({
      instanceUrl: sfTokens!.instanceUrl,
      accessToken: sfTokens!.accessToken,
      version: '59.0',
    });

    // Build SOQL query with validated inputs
    const fieldList = validatedFields.join(', ');
    const idList = safeIds.map(id => `'${id}'`).join(', ');
    const soql = `SELECT ${fieldList} FROM Opportunity WHERE Id IN (${idList})`;

    // Execute query
    const result = await conn.query<EnrichedOpportunity>(soql);

    // Transform results to include Account.Name as AccountName
    const enrichedData = result.records.map(record => ({
      ...record,
      AccountName: (record as any).Account?.Name,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedData,
      totalRequested: opportunityIds.length,
      totalFound: result.totalSize,
      source: 'salesforce',
    });
  } catch (error: any) {
    console.error('Salesforce enrichment error:', error instanceof Error ? error.message : 'Unknown error');

    // Handle specific Salesforce errors
    if (error.errorCode === 'INVALID_SESSION_ID') {
      return NextResponse.json(
        {
          error: 'Salesforce session expired',
          message: 'Please reconnect your Salesforce account',
          requiresReconnection: true,
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to enrich data from Salesforce' },
      { status: 500 }
    );
  }
}

// GET endpoint to check SF connection status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sfTokens = getSalesforceTokens(session);

    return NextResponse.json({
      connected: !!sfTokens,
      instanceUrl: sfTokens?.instanceUrl || null,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: 'Failed to check connection status',
    });
  }
}
