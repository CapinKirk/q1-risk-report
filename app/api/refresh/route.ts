import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Simple API key check for protection
const API_KEY = process.env.REFRESH_API_KEY;

export async function POST(request: Request) {
  // Check for API key if configured
  if (API_KEY) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    // Path to the generate-data script
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-data.py');

    // Run the Python script
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`, {
      timeout: 120000, // 2 minute timeout
    });

    if (stderr && !stderr.includes('Running')) {
      console.error('Script stderr:', stderr);
    }

    // Read the generated data to get report date
    const dataPath = path.join(process.cwd(), 'data', 'report-data.json');
    const dataContent = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(dataContent);

    return NextResponse.json({
      success: true,
      message: 'Data refreshed successfully',
      report_date: data.report_date,
      qtd_attainment: data.grand_total?.total_qtd_attainment_pct,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh data',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/refresh',
    method: 'POST',
    description: 'Refreshes report data from BigQuery',
    auth: API_KEY ? 'Bearer token required' : 'No auth configured',
  });
}
