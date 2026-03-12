import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execFileAsync = promisify(execFile);

// API key required — fail closed if not configured
const API_KEY = process.env.REFRESH_API_KEY;

export async function POST(request: Request) {
  // Require API key — reject if not configured
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Refresh endpoint not configured' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${API_KEY}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Path to the generate-data script
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-data.py');

    // Run the Python script (execFile avoids shell interpretation)
    const { stderr } = await execFileAsync('python3', [scriptPath], {
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
      { error: 'Failed to refresh data' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
