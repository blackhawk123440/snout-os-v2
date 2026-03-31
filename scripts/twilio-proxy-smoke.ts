/**
 * Twilio Proxy Smoke Test
 * 
 * This script validates that Twilio credentials are correctly configured
 * and can access the Proxy Service specified in TWILIO_PROXY_SERVICE_SID.
 * 
 * Run: npx tsx scripts/twilio-proxy-smoke.ts
 */

import twilio from 'twilio';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Direct access to environment variables (bypass full env validation)
const getEnv = (key: string): string | undefined => process.env[key];

async function smokeTest() {
  console.log('🔍 Twilio Proxy Smoke Test\n');

  // Step 1: Validate environment variables
  console.log('Step 1: Validating environment variables...');
  
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PROXY_SERVICE_SID',
  ];

  const missing: string[] = [];
  for (const varName of requiredVars) {
    const value = getEnv(varName);
    if (!value) {
      missing.push(varName);
    } else {
      // Mask sensitive values
      const masked = varName.includes('TOKEN') || varName.includes('AUTH')
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`  ✓ ${varName}: ${masked}`);
    }
  }

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('  ✓ All required environment variables present\n');

  // Step 2: Initialize Twilio client
  console.log('Step 2: Initializing Twilio client...');
  let client: twilio.Twilio;
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')!;
  const authToken = getEnv('TWILIO_AUTH_TOKEN')!;
  const proxyServiceSid = getEnv('TWILIO_PROXY_SERVICE_SID')!;
  
  try {
    client = twilio(accountSid, authToken);
    console.log(`  ✓ Client initialized with Account SID: ${accountSid}\n`);
  } catch (error: any) {
    console.error(`\n❌ Failed to initialize Twilio client: ${error.message}`);
    console.error('\nPossible causes:');
    console.error('  - Invalid Account SID format');
    console.error('  - Invalid Auth Token format');
    console.error('  - Credentials from different accounts');
    process.exit(1);
  }

  // Step 3: List Proxy Services (validates credentials)
  console.log('Step 3: Listing Proxy Services (validates credentials)...');
  try {
    const services = await client.proxy.v1.services.list({ limit: 20 });
    console.log(`  ✓ Found ${services.length} Proxy Service(s)`);
    
    if (services.length === 0) {
      console.warn('  ⚠️  No Proxy Services found in account');
      console.warn('     You may need to create a Proxy Service in Twilio Console');
    } else {
      services.forEach((service) => {
        console.log(`    - ${service.sid}: ${(service as any).friendlyName || 'Unnamed'}`);
      });
    }
    console.log('');
  } catch (error: any) {
    console.error(`\n❌ Failed to list Proxy Services: ${error.message}`);
    console.error(`   Error Code: ${error.code || 'UNKNOWN'}`);
    console.error('\nPossible causes:');
    console.error('  - Account SID and Auth Token mismatch (different accounts)');
    console.error('  - Using subaccount SID with parent account Auth Token');
    console.error('  - Using test credentials with production resources');
    console.error('  - Insufficient permissions on account');
    process.exit(1);
  }

  // Step 4: Fetch specific Proxy Service (validates SERVICE_SID)
  console.log(`Step 4: Fetching Proxy Service ${proxyServiceSid}...`);
  try {
    const service = await client.proxy.v1.services(proxyServiceSid).fetch();
    console.log(`  ✓ Proxy Service found: ${(service as any).friendlyName || service.sid}`);
    console.log(`    - SID: ${service.sid}`);
    console.log(`    - Unique Name: ${service.uniqueName || 'N/A'}`);
    console.log(`    - Created: ${service.dateCreated?.toISOString() || 'N/A'}\n`);
  } catch (error: any) {
    console.error(`\n❌ Failed to fetch Proxy Service: ${error.message}`);
    console.error(`   Error Code: ${error.code || 'UNKNOWN'}`);
    console.error(`   Service SID: ${proxyServiceSid}\n`);
    console.error('Possible causes:');
    console.error('  - Proxy Service SID does not exist in this account');
    console.error('  - Proxy Service SID belongs to a different account');
    console.error('  - Service was deleted');
    console.error('\nAction required:');
    console.error('  1. Verify TWILIO_PROXY_SERVICE_SID in .env.local');
    console.error('  2. Create a Proxy Service in Twilio Console if needed');
    console.error('  3. Ensure the Service SID matches your account');
    process.exit(1);
  }

  // Step 5: Verify Proxy Service is accessible (list sessions)
  console.log('Step 5: Verifying Proxy Service is accessible (listing sessions)...');
  try {
    const sessions = await client.proxy.v1
      .services(proxyServiceSid)
      .sessions.list({ limit: 5 });
    console.log(`  ✓ Proxy Service is accessible`);
    console.log(`    - Current sessions: ${sessions.length}\n`);
  } catch (error: any) {
    console.error(`\n❌ Failed to list sessions: ${error.message}`);
    console.error(`   Error Code: ${error.code || 'UNKNOWN'}\n`);
    console.error('Possible causes:');
    console.error('  - Insufficient permissions on Proxy Service');
    console.error('  - Service configuration issue');
    process.exit(1);
  }

  // Success summary
  console.log('✅ Smoke test PASSED\n');
  console.log('Summary:');
  console.log('  ✓ Credentials are valid');
  console.log('  ✓ Account SID and Auth Token match');
  console.log('  ✓ Proxy Service exists and is accessible');
  console.log('  ✓ Ready to proceed with Phase 1 implementation\n');
}

// Run smoke test
smokeTest().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
