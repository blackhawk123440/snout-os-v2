-- Verification SQL for Sitter Tier Backfill
-- Run these queries to verify the backfill was successful

-- 1. Check all sitters have a tier assigned
SELECT 
  COUNT(*) as total_sitters,
  COUNT(current_tier_id) as sitters_with_tier,
  COUNT(*) - COUNT(current_tier_id) as sitters_without_tier
FROM "Sitter";

-- 2. Show tier distribution
SELECT 
  st.name as tier_name,
  COUNT(s.id) as sitter_count,
  ROUND(AVG(s."commissionPercentage"), 2) as avg_commission
FROM "Sitter" s
LEFT JOIN "SitterTier" st ON s."currentTierId" = st.id
GROUP BY st.name, st."priorityLevel"
ORDER BY st."priorityLevel" DESC;

-- 3. Verify tier history records were created for backfill
SELECT 
  COUNT(*) as backfill_history_records,
  COUNT(DISTINCT "sitterId") as unique_sitters
FROM "SitterTierHistory"
WHERE "reason" LIKE '%backfill%'
   OR (metadata::text LIKE '%backfill%' AND metadata::text LIKE '%true%');

-- 4. Verify event logs were created
SELECT 
  COUNT(*) as backfill_event_logs,
  COUNT(DISTINCT (metadata::json->>'sitterId')) as unique_sitters
FROM "EventLog"
WHERE "eventType" = 'sitter.tier.changed'
  AND metadata::text LIKE '%backfill%';

-- 5. Show recent tier changes (including backfill)
SELECT 
  sth."sitterId",
  s."firstName" || ' ' || s."lastName" as sitter_name,
  st.name as tier_name,
  sth."reason",
  sth."changedBy",
  sth."createdAt"
FROM "SitterTierHistory" sth
JOIN "Sitter" s ON sth."sitterId" = s.id
JOIN "SitterTier" st ON sth."tierId" = st.id
WHERE sth."reason" LIKE '%backfill%'
ORDER BY sth."createdAt" DESC
LIMIT 20;

-- 6. Check for any sitters still without tier (should be 0)
SELECT 
  s.id,
  s."firstName" || ' ' || s."lastName" as sitter_name,
  s."currentTierId",
  s."createdAt"
FROM "Sitter" s
WHERE s."currentTierId" IS NULL
ORDER BY s."createdAt" DESC;

-- 7. Verify commission percentages match tier splits
SELECT 
  st.name as tier_name,
  st."commissionSplit" as tier_commission,
  COUNT(*) as sitter_count,
  COUNT(CASE WHEN s."commissionPercentage" = st."commissionSplit" THEN 1 END) as matching_commission,
  COUNT(CASE WHEN s."commissionPercentage" != st."commissionSplit" THEN 1 END) as mismatched_commission
FROM "Sitter" s
JOIN "SitterTier" st ON s."currentTierId" = st.id
GROUP BY st.name, st."commissionSplit"
ORDER BY st."priorityLevel" DESC;
