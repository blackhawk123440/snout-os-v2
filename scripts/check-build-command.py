#!/usr/bin/env python3
import json
import subprocess
import sys

def get_service_config():
    """Fetch service configuration from Render API"""
    api_key = "rnd_IM2guplHLHxTojANNEjvaxAdQ7fG"
    service_id = "srv-d5abmh3uibrs73boq1kg"
    url = f"https://api.render.com/v1/services/{service_id}"
    
    result = subprocess.run(
        ["curl", "-s", "-H", f"Authorization: Bearer {api_key}", url],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"Error fetching service config: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        # Handle both direct service object and nested service.service structure
        service = data.get('service', data)
        details = service.get('serviceDetails', {})
        env_details = details.get('envSpecificDetails', {})
        
        build_cmd = env_details.get('buildCommand', '')
        if not build_cmd:
            # Try alternative path
            build_cmd = details.get('buildCommand', '')
        
        return {
            'buildCommand': build_cmd.strip() if build_cmd else '',
            'startCommand': env_details.get('startCommand', details.get('startCommand', '')).strip(),
            'rootDir': service.get('rootDir', '') or '. (root)',
        }
    except json.JSONDecodeError:
        print(f"Error parsing JSON: {result.stdout[:200]}")
        return None

if __name__ == '__main__':
    print("=" * 60)
    print("BUILD COMMAND VERIFICATION")
    print("=" * 60)
    print()
    
    config = get_service_config()
    if not config:
        print("❌ Failed to fetch service configuration")
        sys.exit(1)
    
    print("Current Configuration:")
    print(f"  Build Command: {config['buildCommand']}")
    print(f"  Start Command: {config['startCommand']}")
    print(f"  Root Directory: {config['rootDir']}")
    print()
    
    expected_build = "prisma generate --schema=enterprise-messaging-dashboard/apps/api/prisma/schema.prisma && next build"
    build_cmd = config['buildCommand']
    
    print("Verification:")
    if 'prisma generate' in build_cmd and 'next build' in build_cmd:
        print("  ✅ Build command includes Prisma generation")
        print("  ✅ Build command includes next build")
        if expected_build in build_cmd or build_cmd == expected_build:
            print("  ✅ Build command matches expected format")
            print()
            print("=" * 60)
            print("✅ BUILD COMMAND IS CORRECT")
            print("=" * 60)
            sys.exit(0)
        else:
            print("  ⚠️  Build command format differs but includes required steps")
    else:
        print("  ❌ Build command does NOT include Prisma generation")
        print("  ❌ Build command may not include next build")
        print()
        print("Expected:")
        print(f"  {expected_build}")
        print()
        print("=" * 60)
        print("❌ BUILD COMMAND NEEDS UPDATE")
        print("=" * 60)
        sys.exit(1)
