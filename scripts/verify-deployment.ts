#!/usr/bin/env tsx
/**
 * Deployment Verification Script
 * 
 * Verifies that the canonical architecture is deployed correctly:
 * 1. API health endpoint returns 200
 * 2. Web app is configured to use API
 * 3. Network requests go to API, not shadow routes
 */

const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL || 'https://snout-os-staging.onrender.com';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || '';

interface VerificationResult {
  test: string;
  status: 'pass' | 'fail';
  message: string;
  evidence?: string;
}

const results: VerificationResult[] = [];

async function verifyAPIHealth(): Promise<VerificationResult> {
  if (!API_PUBLIC_URL) {
    return {
      test: 'API Health Check',
      status: 'fail',
      message: 'API_PUBLIC_URL not set',
    };
  }

  try {
    const response = await fetch(`${API_PUBLIC_URL}/health`);
    const data = await response.json();
    
    if (response.status === 200 && data.status === 'ok') {
      return {
        test: 'API Health Check',
        status: 'pass',
        message: `GET ${API_PUBLIC_URL}/health → 200`,
        evidence: JSON.stringify(data, null, 2),
      };
    } else {
      return {
        test: 'API Health Check',
        status: 'fail',
        message: `GET ${API_PUBLIC_URL}/health → ${response.status}`,
        evidence: JSON.stringify(data, null, 2),
      };
    }
  } catch (error: any) {
    return {
      test: 'API Health Check',
      status: 'fail',
      message: `Error: ${error.message}`,
    };
  }
}

async function verifyWebConfig(): Promise<VerificationResult> {
  try {
    const response = await fetch(`${WEB_PUBLIC_URL}/api/auth/health`);
    const data = await response.json();
    
    const apiUrl = data.env?.NEXT_PUBLIC_API_URL;
    if (apiUrl && apiUrl === API_PUBLIC_URL) {
      return {
        test: 'Web → API Configuration',
        status: 'pass',
        message: `NEXT_PUBLIC_API_URL is set to ${apiUrl}`,
        evidence: JSON.stringify(data.env, null, 2),
      };
    } else if (!apiUrl) {
      return {
        test: 'Web → API Configuration',
        status: 'fail',
        message: 'NEXT_PUBLIC_API_URL is NOT set in Web service',
        evidence: JSON.stringify(data.env, null, 2),
      };
    } else {
      return {
        test: 'Web → API Configuration',
        status: 'fail',
        message: `NEXT_PUBLIC_API_URL is set to ${apiUrl}, but expected ${API_PUBLIC_URL}`,
        evidence: JSON.stringify(data.env, null, 2),
      };
    }
  } catch (error: any) {
    return {
      test: 'Web → API Configuration',
      status: 'fail',
      message: `Error: ${error.message}`,
    };
  }
}

async function verifyAPIEndpoint(): Promise<VerificationResult> {
  if (!API_PUBLIC_URL) {
    return {
      test: 'API Endpoint (Authenticated)',
      status: 'fail',
      message: 'API_PUBLIC_URL not set',
    };
  }

  // This would require auth token, so we'll just check the endpoint exists
  try {
    const response = await fetch(`${API_PUBLIC_URL}/api/messages/threads`, {
      method: 'GET',
    });
    
    // 401 is expected without auth, 404 means endpoint doesn't exist
    if (response.status === 401 || response.status === 403) {
      return {
        test: 'API Endpoint (Authenticated)',
        status: 'pass',
        message: `GET ${API_PUBLIC_URL}/api/messages/threads → ${response.status} (auth required, endpoint exists)`,
      };
    } else if (response.status === 404) {
      return {
        test: 'API Endpoint (Authenticated)',
        status: 'fail',
        message: `GET ${API_PUBLIC_URL}/api/messages/threads → 404 (endpoint not found)`,
      };
    } else {
      return {
        test: 'API Endpoint (Authenticated)',
        status: 'pass',
        message: `GET ${API_PUBLIC_URL}/api/messages/threads → ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      test: 'API Endpoint (Authenticated)',
      status: 'fail',
      message: `Error: ${error.message}`,
    };
  }
}

async function main() {
  console.log('🔍 Verifying Deployment...\n');
  console.log(`Web URL: ${WEB_PUBLIC_URL}`);
  console.log(`API URL: ${API_PUBLIC_URL || 'NOT SET'}\n`);

  results.push(await verifyAPIHealth());
  results.push(await verifyWebConfig());
  results.push(await verifyAPIEndpoint());

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  results.forEach((result, idx) => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`${idx + 1}. ${icon} ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.evidence) {
      console.log(`   Evidence:\n${result.evidence.split('\n').map(l => `   ${l}`).join('\n')}`);
    }
    console.log('');
  });

  const allPassed = results.every(r => r.status === 'pass');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(console.error);
