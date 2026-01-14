import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate, products, regions } = body;

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Calculate previous period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysDiff + 1);

    const prevStartDate = prevStart.toISOString().split('T')[0];
    const prevEndDate = prevEnd.toISOString().split('T')[0];

    // Build script arguments
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-trend-data.py');
    const productsArg = (products && products.length > 0) ? products.join(',') : 'POR,R360';
    const regionsArg = (regions && regions.length > 0) ? regions.join(',') : 'AMER,EMEA,APAC';

    const args = [
      `--start-date=${startDate}`,
      `--end-date=${endDate}`,
      `--prev-start-date=${prevStartDate}`,
      `--prev-end-date=${prevEndDate}`,
      `--products=${productsArg}`,
      `--regions=${regionsArg}`,
    ];

    console.log(`Running trend analysis: python3 ${scriptPath} ${args.join(' ')}`);

    // Run the Python script
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath} ${args.join(' ')}`, {
      timeout: 180000, // 3 minute timeout
    });

    if (stderr && !stderr.includes('Running')) {
      console.error('Script stderr:', stderr);
    }

    // Read the generated data
    const dataPath = path.join(process.cwd(), 'data', 'trend-analysis.json');
    const dataContent = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(dataContent);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Trend analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run trend analysis',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/trend-analysis',
    method: 'POST',
    description: 'Runs trend analysis comparing two date periods',
    parameters: {
      startDate: 'YYYY-MM-DD (required)',
      endDate: 'YYYY-MM-DD (required)',
      products: 'Array of products ["POR", "R360"] (optional)',
      regions: 'Array of regions ["AMER", "EMEA", "APAC"] (optional)',
    },
    example: {
      startDate: '2026-01-08',
      endDate: '2026-01-14',
      products: ['POR'],
      regions: ['AMER', 'EMEA'],
    },
  });
}
