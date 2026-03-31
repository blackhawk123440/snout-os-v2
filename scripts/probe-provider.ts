#!/usr/bin/env npx tsx
/**
 * Quick probe: verify which messaging provider is active and send a test SMS.
 */
import { getMessagingProvider } from '@/lib/messaging/provider-factory';

async function main() {
  const provider = await getMessagingProvider('default');
  const name = provider.constructor.name;
  console.log(`Active provider: ${name}`);

  if (name === 'OpenPhoneProvider') {
    console.log('✅ OpenPhone is active');
    const result = await provider.sendMessage({
      to: process.env.TEST_CLIENT_PHONE || '+12562589183',
      body: '🐕 Snout OS provider test — if you received this, OpenPhone is connected.',
    });
    console.log('Send result:', JSON.stringify(result, null, 2));
    if (result.success) {
      console.log('✅ SMS sent successfully via OpenPhone');
    } else {
      console.log('❌ SMS failed:', result.errorMessage);
    }
  } else {
    console.log('❌ Expected OpenPhoneProvider but got', name);
    console.log('Check MESSAGING_PROVIDER=openphone in .env');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
