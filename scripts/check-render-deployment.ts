#!/usr/bin/env tsx
/**
 * Check Render Deployment Status
 * 
 * Uses Render API to check service deployment status
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

async function listServices() {
  try {
    const services = await renderApiRequest('/services') as any[];
    return services;
  } catch (error) {
    console.error('Failed to list services:', error);
    return [];
  }
}

async function getServiceDetails(serviceId: string) {
  try {
    return await renderApiRequest(`/services/${serviceId}`) as any;
  } catch (error) {
    console.error(`Failed to get service ${serviceId}:`, error);
    return null;
  }
}

async function getDeployments(serviceId: string) {
  try {
    return await renderApiRequest(`/services/${serviceId}/deploys`) as any[];
  } catch (error) {
    console.error(`Failed to get deployments for ${serviceId}:`, error);
    return [];
  }
}

async function main() {
  console.log('🔍 Checking Render deployment status...\n');

  const services = await listServices();
  
  if (services.length === 0) {
    console.log('❌ No services found. Services may need to be created manually.');
    console.log('\n📋 Required services from render.yaml:');
    console.log('  1. snout-os-web (Web Service)');
    console.log('  2. snout-os-api (Web Service)');
    console.log('  3. snout-os-worker (Background Worker)');
    console.log('  4. snout-os-db (PostgreSQL)');
    console.log('  5. snout-os-redis (Redis)');
    console.log('\n💡 To deploy:');
    console.log('  - Go to https://dashboard.render.com');
    console.log('  - Click "New +" → "Blueprint"');
    console.log('  - Connect repo: blackhawk123440/snout-os');
    console.log('  - Select render.yaml from root');
    return;
  }

  console.log(`✅ Found ${services.length} service(s):\n`);

  for (const service of services) {
    const serviceId = service.id || service.service?.id;
    const serviceName = service.name || service.service?.name;
    const serviceType = service.type || service.service?.type;
    
    if (!serviceId) {
      console.log(`⚠️  Service with missing ID:`, JSON.stringify(service, null, 2));
      continue;
    }

    try {
      const details = await getServiceDetails(serviceId);
      const deployments = await getDeployments(serviceId);
      const latestDeploy = deployments?.[0];

      console.log(`📦 ${serviceName || 'Unknown'} (${serviceType || 'unknown'})`);
      console.log(`   ID: ${serviceId}`);
      console.log(`   Status: ${details?.service?.suspendedAt ? 'suspended' : details?.service?.status || 'unknown'}`);
      console.log(`   URL: ${details?.service?.serviceDetails?.url || details?.service?.url || 'N/A'}`);
      
      if (latestDeploy) {
        console.log(`   Latest Deploy: ${latestDeploy.status} (${latestDeploy.finishedAt || latestDeploy.createdAt})`);
        if (latestDeploy.status === 'live') {
          console.log(`   ✅ Deployed successfully`);
        } else if (latestDeploy.status === 'build_failed' || latestDeploy.status === 'update_failed') {
          console.log(`   ❌ Deployment failed`);
        } else {
          console.log(`   ⏳ Deployment in progress: ${latestDeploy.status}`);
        }
      } else {
        console.log(`   ⚠️  No deployments found`);
      }
    } catch (error: any) {
      console.log(`📦 ${serviceName || 'Unknown'} (${serviceType || 'unknown'})`);
      console.log(`   ID: ${serviceId}`);
      console.log(`   ⚠️  Could not fetch details: ${error.message}`);
    }
    console.log('');
  }

  // Check for required services
  const requiredServices = ['snout-os-web', 'snout-os-api', 'snout-os-worker'];
  const foundServices = services.map(s => s.name);
  const missingServices = requiredServices.filter(name => !foundServices.includes(name));

  if (missingServices.length > 0) {
    console.log('⚠️  Missing required services:');
    missingServices.forEach(name => console.log(`  - ${name}`));
    console.log('\n💡 Create these services manually or use Render Blueprint.');
  } else {
    console.log('✅ All required services found!');
  }
}

main().catch(console.error);
