#!/usr/bin/env tsx
/**
 * Trigger Render Service Deployment
 * 
 * Manually triggers a deployment for a service
 */

const RENDER_API_KEY = 'rnd_IM2guplHLHxTojANNEjvaxAdQ7fG';
const RENDER_API_BASE = 'https://api.render.com/v1';

async function renderApiRequest(endpoint: string, method: string = 'GET', body?: any) {
  const url = `${RENDER_API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Render API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  return response.json();
}

async function triggerDeploy(serviceId: string, clearCache: boolean) {
  try {
    const suffix = clearCache ? '?clearCache=clear' : '';
    const result = await renderApiRequest(`/services/${serviceId}/deploys${suffix}`, 'POST');
    return result;
  } catch (error) {
    throw error;
  }
}

async function main() {
  const clearCache = process.env.CLEAR_CACHE === 'true';
  const serviceIds = {
    web: 'srv-d5abmh3uibrs73boq1kg', // snout-os-staging
    worker: 'srv-d63jnnmr433s73dqep70', // snout-os-worker
  };

  console.log(`🚀 Triggering deployments for web + worker (clearCache=${clearCache})...\n`);

  for (const [name, serviceId] of Object.entries(serviceIds)) {
    try {
      console.log(`📦 Triggering deploy for ${name} (${serviceId})...`);
      const result = await triggerDeploy(serviceId, clearCache);
      const sha = result?.commit?.id ? String(result.commit.id).slice(0, 7) : 'unknown';
      console.log(`   ✅ Deployment triggered: ${result.id || 'success'} (sha=${sha})`);
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
    console.log('');
  }

  console.log('✅ Deployment triggers complete!');
  console.log('\n💡 Check deployment status at: https://dashboard.render.com');
  console.log('   Or wait a few minutes and check service logs.');
}

main().catch(console.error);
