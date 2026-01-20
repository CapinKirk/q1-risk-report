import { test, expect } from '@playwright/test';

test.describe('SAL and SQO Detail Tables', () => {
  test('should return SAL details with POR records', async ({ request }) => {
    const response = await request.post('/api/report-data', {
      data: {
        startDate: '2026-01-01',
        endDate: '2026-01-16',
        products: ['POR'],
        regions: ['AMER', 'EMEA', 'APAC']
      }
    });

    console.log('Response status:', response.status());
    const json = await response.json();
    
    if (response.status() !== 200) {
      console.log('Error response:', json);
    } else {
      console.log('SAL Details keys:', Object.keys(json.sal_details || {}));
      if (json.sal_details?.POR) {
        console.log(`POR SAL Details Count: ${json.sal_details.POR.length}`);
      }
    }
    
    expect(response.ok()).toBeTruthy();
    expect(json).toHaveProperty('sal_details');
    expect(json.sal_details).toHaveProperty('POR');
    expect(Array.isArray(json.sal_details.POR)).toBe(true);
    expect(json.sal_details.POR.length).toBeGreaterThan(0);
  });

  test('should return SQO details with POR records', async ({ request }) => {
    const response = await request.post('/api/report-data', {
      data: {
        startDate: '2026-01-01',
        endDate: '2026-01-16',
        products: ['POR'],
        regions: ['AMER', 'EMEA', 'APAC']
      }
    });

    console.log('Response status:', response.status());
    const json = await response.json();
    
    if (response.status() !== 200) {
      console.log('Error response:', json);
    } else {
      console.log('SQO Details keys:', Object.keys(json.sqo_details || {}));
      if (json.sqo_details?.POR) {
        console.log(`POR SQO Details Count: ${json.sqo_details.POR.length}`);
      }
    }
    
    expect(response.ok()).toBeTruthy();
    expect(json).toHaveProperty('sqo_details');
    expect(json.sqo_details).toHaveProperty('POR');
    expect(Array.isArray(json.sqo_details.POR)).toBe(true);
    expect(json.sqo_details.POR.length).toBeGreaterThan(0);
  });

  test('should verify SAL and SQO details structure', async ({ request }) => {
    const response = await request.post('/api/report-data', {
      data: {
        startDate: '2026-01-01',
        endDate: '2026-01-16'
      }
    });

    const json = await response.json();
    
    expect(response.ok()).toBeTruthy();
    
    // Log available fields
    const availableFields = Object.keys(json);
    console.log('Available response fields:', availableFields);
    
    // Check if sal_details and sqo_details exist
    const hasSalDetails = availableFields.includes('sal_details');
    const hasSqoDetails = availableFields.includes('sqo_details');
    
    console.log('Has sal_details:', hasSalDetails);
    console.log('Has sqo_details:', hasSqoDetails);
    
    if (hasSalDetails && json.sal_details) {
      const porCount = json.sal_details.POR?.length || 0;
      const r360Count = json.sal_details.R360?.length || 0;
      console.log(`SAL Details - POR: ${porCount}, R360: ${r360Count}`);
    }
    
    if (hasSqoDetails && json.sqo_details) {
      const porCount = json.sqo_details.POR?.length || 0;
      const r360Count = json.sqo_details.R360?.length || 0;
      console.log(`SQO Details - POR: ${porCount}, R360: ${r360Count}`);
    }
  });
});
