/**
 * Salesforce Client for Real-time Data Queries
 *
 * Supports two authentication methods:
 * 1. Username-Password Flow (simpler, requires SALESFORCE_USERNAME, SALESFORCE_PASSWORD, SALESFORCE_SECURITY_TOKEN)
 * 2. JWT Bearer Flow (more secure, requires SALESFORCE_CLIENT_ID, SALESFORCE_PRIVATE_KEY, SALESFORCE_USERNAME)
 *
 * Environment Variables Required:
 * - SALESFORCE_LOGIN_URL (default: https://login.salesforce.com)
 * - SALESFORCE_USERNAME
 * - SALESFORCE_PASSWORD (for username-password flow)
 * - SALESFORCE_SECURITY_TOKEN (for username-password flow)
 * - SALESFORCE_CLIENT_ID (for JWT flow)
 * - SALESFORCE_PRIVATE_KEY (for JWT flow, base64 encoded)
 */

import jsforce, { Connection } from 'jsforce';

// Singleton connection instance
let connectionInstance: Connection | null = null;
let connectionExpiry: number = 0;

// Connection timeout (tokens typically last 2 hours, refresh after 1.5)
const CONNECTION_TTL_MS = 90 * 60 * 1000; // 90 minutes

/**
 * Get or create a Salesforce connection
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
 */
export async function executeSoqlQuery<T = any>(soql: string): Promise<T[]> {
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
 * Check if Salesforce credentials are configured
 */
export function isSalesforceConfigured(): boolean {
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
