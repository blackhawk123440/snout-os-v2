#!/usr/bin/env tsx
/**
 * Render API Automation Script
 * 
 * Uses Render API to:
 * - List services
 * - Set environment variables
 * - Check service status
 * - Help with deployment
 * 
 * Usage:
 *   RENDER_API_KEY=your_key tsx scripts/render-automation.ts list-services
 *   RENDER_API_KEY=your_key tsx scripts/render-automation.ts set-env <service-name> <key> <value>
 *   RENDER_API_KEY=your_key tsx scripts/render-automation.ts get-env <service-name>
 */

const RENDER_API_BASE = 'https://api.render.com/v1';

interface RenderService {
  id: string;
  name: string;
  type: string;
  serviceDetails?: {
    url?: string;
  };
  envVars?: Array<{ key: string; value: string }>;
}

async function renderApiRequest(endpoint: string, method = 'GET', body?: any) {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    throw new Error('RENDER_API_KEY environment variable is required');
  }

  const url = `${RENDER_API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Render API error: ${response.status} ${error}`);
  }

  return response.json();
}

async function listServices() {
  console.log('📋 Fetching Render services...\n');
  
  const allServices: RenderService[] = [];
  let cursor: string | null = null;
  
  // Handle pagination
  do {
    const endpoint = cursor ? `/services?cursor=${cursor}` : '/services';
    const response = await renderApiRequest(endpoint) as any;
    
    // Render API returns array of { cursor, service } objects
    const items = Array.isArray(response) ? response : [];
    
    for (const item of items) {
      const service = item.service || item;
      const name = service.name || service.slug || 'Unknown';
      const id = service.id || 'Unknown';
      const type = service.type || 'Unknown';
      const url = service.serviceDetails?.url || service.url;
      
      allServices.push({
        id,
        name,
        type,
        serviceDetails: url ? { url } : undefined,
      });
    }
    
    // Check for pagination cursor
    cursor = items.length > 0 && items[items.length - 1].cursor ? items[items.length - 1].cursor : null;
  } while (cursor);
  
  if (allServices.length === 0) {
    console.log('No services found.');
    return [];
  }

  console.log(`Found ${allServices.length} service(s):\n`);
  
  for (const service of allServices) {
    console.log(`🔹 ${service.name}`);
    console.log(`   ID: ${service.id}`);
    console.log(`   Type: ${service.type}`);
    if (service.serviceDetails?.url) {
      console.log(`   URL: ${service.serviceDetails.url}`);
    }
    console.log('');
  }
  
  return allServices;
}

async function getServiceByName(name: string): Promise<RenderService | null> {
  // Fetch all services (with pagination)
  const allServices: RenderService[] = [];
  let cursor: string | null = null;
  
  do {
    const endpoint = cursor ? `/services?cursor=${cursor}` : '/services';
    const response = await renderApiRequest(endpoint) as any;
    const items = Array.isArray(response) ? response : [];
    
    for (const item of items) {
      const service = item.service || item;
      const serviceName = service.name || service.slug || 'Unknown';
      const serviceId = service.id || 'Unknown';
      const serviceType = service.type || 'Unknown';
      const serviceUrl = service.serviceDetails?.url || service.url;
      
      allServices.push({
        id: serviceId,
        name: serviceName,
        type: serviceType,
        serviceDetails: serviceUrl ? { url: serviceUrl } : undefined,
      });
    }
    
    cursor = items.length > 0 && items[items.length - 1].cursor ? items[items.length - 1].cursor : null;
  } while (cursor);
  
  return allServices.find((s: RenderService) => s.name === name) || null;
}

async function getEnvVars(serviceId: string) {
  try {
    const response = await renderApiRequest(`/services/${serviceId}/env-vars`) as any;
    // Handle different response formats
    const envVars = Array.isArray(response) ? response : (response.envVars || []);
    return envVars.map((v: any) => ({
      key: v.key || v.name,
      value: v.value,
    }));
  } catch (e: any) {
    console.log(`⚠️  Could not fetch env vars: ${e.message}`);
    return [];
  }
}

async function setEnvVar(serviceId: string, key: string, value: string) {
  // Render API uses POST to create/update env vars
  // The endpoint is: POST /services/:serviceId/env-vars
  // Body: { key: string, value: string }
  
  try {
    await renderApiRequest(`/services/${serviceId}/env-vars`, 'POST', { key, value });
    console.log(`✅ Set ${key} for service ${serviceId}`);
  } catch (e: any) {
    // If it's a 405, try alternative endpoint format
    if (e.message.includes('405')) {
      try {
        // Try with the key in the path
        await renderApiRequest(`/services/${serviceId}/env-vars/${key}`, 'PUT', { value });
        console.log(`✅ Updated ${key} for service ${serviceId}`);
      } catch (e2: any) {
        throw new Error(`Failed to set ${key}: ${e.message}. Try setting it manually in Render dashboard.`);
      }
    } else {
      throw e;
    }
  }
}

async function listEnvVars(serviceName: string) {
  const service = await getServiceByName(serviceName);
  if (!service) {
    console.error(`❌ Service "${serviceName}" not found`);
    process.exit(1);
  }

  console.log(`\n📋 Environment variables for ${serviceName}:\n`);
  
  const envVars = await getEnvVars(service.id);
  
  if (envVars.length === 0) {
    console.log('No environment variables set.');
    return;
  }

  for (const envVar of envVars) {
    // Mask sensitive values
    const displayValue = ['SECRET', 'PASSWORD', 'KEY', 'TOKEN'].some(s => 
      envVar.key.toUpperCase().includes(s)
    ) ? '***REDACTED***' : envVar.value;
    
    console.log(`${envVar.key}=${displayValue}`);
  }
}

async function setEnvVarCommand(serviceName: string, key: string, value: string) {
  const service = await getServiceByName(serviceName);
  if (!service) {
    console.error(`❌ Service "${serviceName}" not found`);
    process.exit(1);
  }

  await setEnvVar(service.id, key, value);
  console.log(`\n✅ Set ${key} on ${serviceName}`);
  console.log(`   Service will redeploy automatically.`);
}

async function setupApiService() {
  console.log('🔧 Setting up API service...\n');
  
  // Check if service exists
  const service = await getServiceByName('snout-os-api');
  
  if (!service) {
    console.log('❌ Service "snout-os-api" not found.');
    console.log('   Please create it manually in Render dashboard first.');
    return;
  }

  console.log(`✅ Found service: ${service.name} (${service.id})\n`);
  console.log(`   Dashboard: https://dashboard.render.com/web/${service.id}\n`);
  
  // Get current env vars
  const currentEnvVars = await getEnvVars(service.id);
  const currentKeys = currentEnvVars.map(v => v.key);
  
  // Required env vars for API
  const requiredVars = {
    'NODE_ENV': 'production',
    'PORT': '3001',
    'CORS_ORIGINS': 'https://snout-os-staging.onrender.com',
    'PROVIDER_MODE': 'mock',
  };

  console.log('📝 Environment variables to set:\n');
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (currentKeys.includes(key)) {
      console.log(`✅ ${key} = ${currentEnvVars.find(v => v.key === key)?.value || '***REDACTED***'} (already set)`);
    } else {
      console.log(`❌ ${key} = ${value} (needs to be set)`);
      console.log(`   → Go to: https://dashboard.render.com/web/${service.id}/environment`);
      console.log(`   → Add: ${key} = ${value}\n`);
    }
  }

  console.log('\n⚠️  You also need to set these manually:');
  console.log('   - DATABASE_URL (from your PostgreSQL service)');
  console.log('   - REDIS_URL (from your Redis service)');
  console.log('   - JWT_SECRET (generate with: openssl rand -base64 48)');
  console.log('   - ENCRYPTION_KEY (generate with: openssl rand -base64 32)');
  console.log(`\n   Direct link: https://dashboard.render.com/web/${service.id}/environment`);
}

async function setupWebService() {
  console.log('🔧 Setting up Web service...\n');
  
  // Try multiple possible names
  const service = await getServiceByName('snout-os-web') || 
                  await getServiceByName('snout-os-staging') ||
                  await getServiceByName('snout-os');
  
  if (!service) {
    console.log('❌ Web service not found. Looking for "snout-os-web", "snout-os-staging", or "snout-os"');
    return;
  }

  console.log(`✅ Found service: ${service.name} (${service.id})\n`);
  console.log(`   Dashboard: https://dashboard.render.com/web/${service.id}\n`);
  
  const currentEnvVars = await getEnvVars(service.id);
  const currentKeys = currentEnvVars.map(v => v.key);
  
  const requiredVars = {
    'NEXT_PUBLIC_ENABLE_MESSAGING_V1': 'true',
    'NEXT_PUBLIC_API_URL': 'https://snout-os-api.onrender.com',
  };

  console.log('📝 Environment variables to set:\n');
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (currentKeys.includes(key)) {
      console.log(`✅ ${key} = ${currentEnvVars.find(v => v.key === key)?.value || '***REDACTED***'} (already set)`);
    } else {
      console.log(`❌ ${key} = ${value} (needs to be set)`);
      console.log(`   → Go to: https://dashboard.render.com/web/${service.id}/environment`);
      console.log(`   → Add: ${key} = ${value}\n`);
    }
  }

  console.log('\n⚠️  You also need to set these manually:');
  console.log('   - NEXTAUTH_URL (your web service URL)');
  console.log('   - NEXTAUTH_SECRET (generate with: openssl rand -base64 48)');
  console.log(`\n   Direct link: https://dashboard.render.com/web/${service.id}/environment`);
}

// Main CLI
const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'list-services':
        await listServices();
        break;
      
      case 'get-env':
        const serviceName = process.argv[3];
        if (!serviceName) {
          console.error('Usage: get-env <service-name>');
          process.exit(1);
        }
        await listEnvVars(serviceName);
        break;
      
      case 'set-env':
        const [svcName, key, value] = process.argv.slice(3);
        if (!svcName || !key || !value) {
          console.error('Usage: set-env <service-name> <key> <value>');
          process.exit(1);
        }
        await setEnvVarCommand(svcName, key, value);
        break;
      
      case 'setup-api':
        await setupApiService();
        break;
      
      case 'setup-web':
        await setupWebService();
        break;
      
      default:
        console.log('Render API Automation Script\n');
        console.log('Usage:');
        console.log('  RENDER_API_KEY=xxx tsx scripts/render-automation.ts list-services');
        console.log('  RENDER_API_KEY=xxx tsx scripts/render-automation.ts get-env <service-name>');
        console.log('  RENDER_API_KEY=xxx tsx scripts/render-automation.ts set-env <service-name> <key> <value>');
        console.log('  RENDER_API_KEY=xxx tsx scripts/render-automation.ts setup-api');
        console.log('  RENDER_API_KEY=xxx tsx scripts/render-automation.ts setup-web');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
