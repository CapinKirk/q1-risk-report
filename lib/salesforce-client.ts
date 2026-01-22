/**
 * Salesforce Client for Real-time Data Queries
 *
 * Supports three methods (in order of preference):
 * 1. SF CLI (if available) - Uses existing `sf` CLI authentication
 * 2. Username-Password Flow - Requires SALESFORCE_USERNAME, SALESFORCE_PASSWORD, SALESFORCE_SECURITY_TOKEN
 * 3. JWT Bearer Flow - Requires SALESFORCE_CLIENT_ID, SALESFORCE_PRIVATE_KEY, SALESFORCE_USERNAME
 *
 * Environment Variables (optional if SF CLI is configured):
 * - SALESFORCE_LOGIN_URL (default: https://por.my.salesforce.com)
 * - SALESFORCE_USERNAME
 * - SALESFORCE_PASSWORD (for username-password flow)
 * - SALESFORCE_SECURITY_TOKEN (for username-password flow)
 * - SALESFORCE_CLIENT_ID (for JWT flow)
 * - SALESFORCE_PRIVATE_KEY (for JWT flow, base64 encoded)
 * - SALESFORCE_TARGET_ORG (default: por-prod) - for SF CLI
 */

import jsforce, { Connection } from 'jsforce';
import { execSync } from 'child_process';

// Singleton connection instance
let connectionInstance: Connection | null = null;
let connectionExpiry: number = 0;

// Cache SF CLI availability check
let sfCliAvailable: boolean | null = null;

// Connection timeout (tokens typically last 2 hours, refresh after 1.5)
const CONNECTION_TTL_MS = 90 * 60 * 1000; // 90 minutes

/**
 * Check if SF CLI is available and authenticated
 */
export function isSfCliAvailable(): boolean {
  if (sfCliAvailable !== null) {
    return sfCliAvailable;
  }

  try {
    const targetOrg = process.env.SALESFORCE_TARGET_ORG || 'por-prod';
    // Check if sf CLI is installed and can reach the org
    execSync(`sf org display --target-org ${targetOrg} --json`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    sfCliAvailable = true;
    console.log('Salesforce: SF CLI available with org', targetOrg);
    return true;
  } catch {
    sfCliAvailable = false;
    console.log('Salesforce: SF CLI not available, will use API credentials');
    return false;
  }
}

/**
 * Execute a SOQL query using SF CLI
 */
export function executeSoqlViaCLI<T = any>(soql: string): T[] {
  const targetOrg = process.env.SALESFORCE_TARGET_ORG || 'por-prod';

  try {
    // Escape the SOQL query for shell
    const escapedSoql = soql.replace(/"/g, '\\"');

    const result = execSync(
      `sf data query --target-org ${targetOrg} --query "${escapedSoql}" --json`,
      {
        encoding: 'utf-8',
        timeout: 60000, // 60 second timeout for queries
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large result sets
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const parsed = JSON.parse(result);

    if (parsed.status !== 0) {
      throw new Error(parsed.message || 'SF CLI query failed');
    }

    return (parsed.result?.records || []) as T[];
  } catch (error: any) {
    // Parse error message from CLI output if available
    if (error.stdout) {
      try {
        const errorOutput = JSON.parse(error.stdout);
        throw new Error(errorOutput.message || error.message);
      } catch {
        // Fall through to original error
      }
    }
    console.error('SF CLI query error:', error.message);
    throw error;
  }
}

/**
 * Get or create a Salesforce connection (for API-based queries)
 */
export async function getSalesforceConnection(): Promise<Connection> {
  const now = Date.now();

  // Return existing connection if still valid
  if (connectionInstance && now < connectionExpiry) {
    return connectionInstance;
  }

  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;
  const securityToken = process.env.SALESFORCE_SECURITY_TOKEN || '';
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const privateKey = process.env.SALESFORCE_PRIVATE_KEY;

  if (!username) {
    throw new Error('SALESFORCE_USERNAME environment variable is required');
  }

  const conn = new jsforce.Connection({
    loginUrl,
    version: '59.0', // API version
  });

  // Try JWT Bearer flow first if credentials are available
  if (clientId && privateKey) {
    try {
      // Decode base64 private key
      const decodedKey = Buffer.from(privateKey, 'base64').toString('utf-8');

      await conn.authorize({
        username,
        privateKey: decodedKey,
        clientId,
      } as any);

      console.log('Salesforce: Connected via JWT Bearer flow');
    } catch (jwtError: any) {
      console.warn('JWT auth failed, falling back to username-password:', jwtError.message);

      // Fall back to username-password
      if (!password) {
        throw new Error('SALESFORCE_PASSWORD required for fallback authentication');
      }

      await conn.login(username, password + securityToken);
      console.log('Salesforce: Connected via username-password flow');
    }
  } else if (password) {
    // Username-password flow
    await conn.login(username, password + securityToken);
    console.log('Salesforce: Connected via username-password flow');
  } else {
    throw new Error('Either SALESFORCE_PASSWORD or (SALESFORCE_CLIENT_ID + SALESFORCE_PRIVATE_KEY) required');
  }

  connectionInstance = conn;
  connectionExpiry = now + CONNECTION_TTL_MS;

  return conn;
}

/**
 * Execute a SOQL query against Salesforce
 * Tries SF CLI first, falls back to API if not available
 */
export async function executeSoqlQuery<T = any>(soql: string): Promise<T[]> {
  // Try SF CLI first (preferred for local development)
  if (isSfCliAvailable()) {
    return executeSoqlViaCLI<T>(soql);
  }

  // Fall back to API-based query
  const conn = await getSalesforceConnection();

  try {
    const result = await conn.query(soql);
    return result.records as T[];
  } catch (error: any) {
    console.error('SOQL query error:', error.message);

    // If auth error, clear connection and retry once
    if (error.errorCode === 'INVALID_SESSION_ID') {
      connectionInstance = null;
      connectionExpiry = 0;
      const freshConn = await getSalesforceConnection();
      const retryResult = await freshConn.query(soql);
      return retryResult.records as T[];
    }

    throw error;
  }
}

/**
 * Check if Salesforce credentials are configured (CLI or API)
 */
export function isSalesforceConfigured(): boolean {
  // Check SF CLI first
  if (isSfCliAvailable()) {
    return true;
  }

  // Fall back to checking API credentials
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const privateKey = process.env.SALESFORCE_PRIVATE_KEY;

  // Need username and either password or JWT credentials
  return !!(username && (password || (clientId && privateKey)));
}

/**
 * Division to Region mapping
 */
export function divisionToRegion(division: string): 'AMER' | 'EMEA' | 'APAC' {
  const map: Record<string, 'AMER' | 'EMEA' | 'APAC'> = {
    'US': 'AMER',
    'UK': 'EMEA',
    'AU': 'APAC',
  };
  return map[division] || 'AMER';
}
