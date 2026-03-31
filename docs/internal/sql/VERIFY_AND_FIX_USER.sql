-- Verify and fix user login
-- Run this in Render API service shell: psql $DATABASE_URL -f VERIFY_AND_FIX_USER.sql

-- First, check if user exists
SELECT 
  email, 
  role,
  active,
  "passwordHash" IS NOT NULL as has_password,
  LENGTH("passwordHash") as hash_length
FROM "User" 
WHERE email = 'leah2maria@gmail.com';

-- If user doesn't exist or password is wrong, this will create/update it
DO $$
DECLARE
  org_id TEXT;
  user_id TEXT;
  -- This hash is for password: Saint214!
  password_hash TEXT := '$2b$10$shlVzw6CFY87F2WZV/ieruwuNuuyG9UpQbmc8YBKHEQGnytI9GkCq';
BEGIN
  -- Get first organization
  SELECT id INTO org_id FROM "Organization" LIMIT 1;
  
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Run: pnpm db:seed';
  END IF;
  
  -- Check if user exists
  SELECT id INTO user_id FROM "User" WHERE email = 'leah2maria@gmail.com';
  
  IF user_id IS NULL THEN
    -- Create user
    INSERT INTO "User" (id, "orgId", role, name, email, "passwordHash", active, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::TEXT,
      org_id,
      'owner',
      'Business Owner',
      'leah2maria@gmail.com',
      password_hash,
      true,
      NOW(),
      NOW()
    );
    RAISE NOTICE '✅ User created: leah2maria@gmail.com';
  ELSE
    -- Update password
    UPDATE "User" 
    SET 
      "passwordHash" = password_hash,
      "updatedAt" = NOW()
    WHERE email = 'leah2maria@gmail.com';
    RAISE NOTICE '✅ User password updated: leah2maria@gmail.com';
  END IF;
END $$;

-- Verify after update
SELECT 
  email, 
  role,
  active,
  "passwordHash" IS NOT NULL as has_password,
  SUBSTRING("passwordHash", 1, 20) as hash_preview
FROM "User" 
WHERE email = 'leah2maria@gmail.com';
