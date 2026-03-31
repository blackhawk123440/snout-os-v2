#!/usr/bin/env python3
import json
import sys
import subprocess

def get_env_vars(service_id):
    """Fetch environment variables for a Render service"""
    api_key = "rnd_IM2guplHLHxTojANNEjvaxAdQ7fG"
    url = f"https://api.render.com/v1/services/{service_id}/env-vars"
    result = subprocess.run(
        ["curl", "-s", "-H", f"Authorization: Bearer {api_key}", url],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Error fetching env vars for {service_id}: {result.stderr}")
        return {}
    
    data = json.loads(result.stdout)
    return {item['envVar']['key']: item['envVar']['value'] for item in data}

def check_newlines(value):
    """Check if value has trailing newlines"""
    if value and value.endswith('\n'):
        return f"❌ HAS TRAILING NEWLINE: {repr(value)}"
    return "✅ No trailing newline"

def verify_web_service(vars):
    """Verify Web service environment variables"""
    print("=" * 60)
    print("WEB SERVICE (snout-os-staging) VERIFICATION")
    print("=" * 60)
    
    issues = []
    
    # Check DATABASE_URL
    if 'DATABASE_URL' in vars:
        db_url = vars['DATABASE_URL']
        if 'snout_os_db_staging' in db_url:
            # Check if using internal URL (preferred for Render services)
            if '.oregon-postgres.render.com' in db_url:
                print(f"⚠️  DATABASE_URL: SET but using EXTERNAL URL (should use internal for Render)")
                print(f"   Current: {db_url[:80]}...")
                print(f"   Should be: postgresql://...@dpg-d5ab7v6r433s738a2isg-a/snout_os_db_staging")
                issues.append("DATABASE_URL should use internal URL (without .oregon-postgres.render.com)")
            elif 'dpg-d5ab7v6r433s738a2isg-a/snout_os_db_staging' in db_url:
                print(f"✅ DATABASE_URL: SET (correct database, using internal URL)")
            else:
                print(f"✅ DATABASE_URL: SET (correct database)")
        else:
            print(f"⚠️  DATABASE_URL: SET but wrong database")
            issues.append("DATABASE_URL points to wrong database")
    else:
        print("❌ DATABASE_URL: MISSING (CRITICAL - NextAuth needs this)")
        print("   Required value: postgresql://snout_os_db_staging_user:r5oPEGtD6Cl3SvrvHpc0Q3PUAsJVUTnz@dpg-d5ab7v6r433s738a2isg-a/snout_os_db_staging")
        issues.append("DATABASE_URL is missing")
    
    # Check JWT_SECRET (should NOT be set)
    if 'JWT_SECRET' in vars:
        print("❌ JWT_SECRET: STILL SET (should be DELETED)")
        issues.append("JWT_SECRET should not be set on Web service")
    else:
        print("✅ JWT_SECRET: NOT SET (correct)")
    
    # Check NEXTAUTH_URL
    if 'NEXTAUTH_URL' in vars:
        nextauth_url = vars['NEXTAUTH_URL']
        print(f"NEXTAUTH_URL: {check_newlines(nextauth_url)}")
        if nextauth_url.rstrip() != 'https://snout-os-staging.onrender.com':
            print(f"⚠️  NEXTAUTH_URL value: {repr(nextauth_url)}")
            issues.append("NEXTAUTH_URL has incorrect value or trailing newline")
    else:
        print("❌ NEXTAUTH_URL: MISSING")
        issues.append("NEXTAUTH_URL is missing")
    
    # Check NEXT_PUBLIC_API_URL
    if 'NEXT_PUBLIC_API_URL' in vars:
        api_url = vars['NEXT_PUBLIC_API_URL']
        if api_url == 'https://snout-os-api.onrender.com':
            print(f"✅ NEXT_PUBLIC_API_URL: {api_url}")
        else:
            print(f"⚠️  NEXT_PUBLIC_API_URL: {api_url} (should be https://snout-os-api.onrender.com)")
            issues.append("NEXT_PUBLIC_API_URL has incorrect value")
    else:
        print("❌ NEXT_PUBLIC_API_URL: MISSING")
        issues.append("NEXT_PUBLIC_API_URL is missing")
    
    # Check NEXTAUTH_SECRET
    if 'NEXTAUTH_SECRET' in vars:
        secret_len = len(vars['NEXTAUTH_SECRET'])
        if secret_len >= 32:
            print(f"✅ NEXTAUTH_SECRET: SET (length: {secret_len})")
        else:
            print(f"⚠️  NEXTAUTH_SECRET: SET but too short (length: {secret_len})")
            issues.append("NEXTAUTH_SECRET is too short")
    else:
        print("❌ NEXTAUTH_SECRET: MISSING")
        issues.append("NEXTAUTH_SECRET is missing")
    
    # Check NEXT_PUBLIC_BASE_URL
    if 'NEXT_PUBLIC_BASE_URL' in vars:
        base_url = vars['NEXT_PUBLIC_BASE_URL']
        print(f"NEXT_PUBLIC_BASE_URL: {check_newlines(base_url)}")
        if base_url.rstrip() != 'https://snout-os-staging.onrender.com':
            issues.append("NEXT_PUBLIC_BASE_URL has incorrect value or trailing newline")
    
    print("\n" + "=" * 60)
    if issues:
        print(f"❌ FOUND {len(issues)} ISSUE(S):")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ ALL CHECKS PASSED")
        return True

def verify_api_service(vars):
    """Verify API service environment variables"""
    print("\n" + "=" * 60)
    print("API SERVICE (snout-os-api) VERIFICATION")
    print("=" * 60)
    
    required = {
        'DATABASE_URL': 'postgresql://snout_os_db_staging',
        'REDIS_URL': 'redis://default',
        'JWT_SECRET': None,  # Just check existence
        'ENCRYPTION_KEY': None,
        'CORS_ORIGINS': 'https://snout-os-staging.onrender.com',
        'PROVIDER_MODE': 'mock',
    }
    
    all_good = True
    for key, expected_prefix in required.items():
        if key in vars:
            value = vars[key]
            if expected_prefix:
                if expected_prefix in value:
                    print(f"✅ {key}: SET (correct)")
                else:
                    print(f"⚠️  {key}: SET but value doesn't match expected prefix")
                    all_good = False
            else:
                print(f"✅ {key}: SET")
        else:
            print(f"❌ {key}: MISSING")
            all_good = False
    
    return all_good

def verify_worker_service(vars):
    """Verify Worker service environment variables"""
    print("\n" + "=" * 60)
    print("WORKER SERVICE (snout-os-worker) VERIFICATION")
    print("=" * 60)
    
    required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET']
    
    all_good = True
    for key in required:
        if key in vars:
            print(f"✅ {key}: SET")
        else:
            print(f"❌ {key}: MISSING")
            all_good = False
    
    return all_good

if __name__ == '__main__':
    # Service IDs
    web_id = "srv-d5abmh3uibrs73boq1kg"
    api_id = "srv-d62mrjpr0fns738rirdg"
    worker_id = "srv-d63jnnmr433s73dqep70"
    
    print("Fetching environment variables from Render...")
    print()
    
    web_vars = get_env_vars(web_id)
    api_vars = get_env_vars(api_id)
    worker_vars = get_env_vars(worker_id)
    
    web_ok = verify_web_service(web_vars)
    api_ok = verify_api_service(api_vars)
    worker_ok = verify_worker_service(worker_vars)
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Web Service:   {'✅ PASS' if web_ok else '❌ FAIL'}")
    print(f"API Service:   {'✅ PASS' if api_ok else '❌ FAIL'}")
    print(f"Worker Service: {'✅ PASS' if worker_ok else '❌ FAIL'}")
    
    if web_ok and api_ok and worker_ok:
        print("\n🎉 ALL SERVICES CONFIGURED CORRECTLY")
        sys.exit(0)
    else:
        print("\n⚠️  SOME ISSUES FOUND - See details above")
        sys.exit(1)
