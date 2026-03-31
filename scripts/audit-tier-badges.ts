/**
 * DUPLICATE_LOGIC_AUDIT: Universal Tier Badge Rule
 * 
 * Rule: Any tier display not using SitterTierBadge component is a FAIL.
 * 
 * This script scans the codebase for violations of the universal tier badge rule.
 * 
 * Run: tsx scripts/audit-tier-badges.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  content: string;
  reason: string;
}

const violations: Violation[] = [];

// Patterns that indicate tier badge usage
const TIER_BADGE_PATTERNS = [
  // Bad patterns - using Badge for tier
  /Badge.*currentTier|currentTier.*Badge/,
  /Badge.*tier\.name|tier\.name.*Badge/,
  /Badge.*sitterTier|sitterTier.*Badge/,
  /Badge.*tier\[|tier\[.*Badge/,
  // Good pattern - should use SitterTierBadge
  /SitterTierBadge/,
];

// Files to exclude from audit
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.git/,
  /dist/,
  /build/,
  /scripts\/audit-tier-badges\.ts/, // This file itself
  /SitterTierBadge\.tsx/, // The component itself
];

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function scanFile(filePath: string): void {
  if (shouldExclude(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Skip comments and imports
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('import')) {
      return;
    }

    // Check for Badge JSX usage with tier-related content
    // Pattern: <Badge ...> with tier-related props or content
    if (
      trimmedLine.includes('<Badge') &&
      (trimmedLine.includes('tier') ||
       trimmedLine.includes('currentTier') ||
       trimmedLine.includes('sitterTier'))
    ) {
      // Check if it's NOT using SitterTierBadge
      if (!trimmedLine.includes('SitterTierBadge')) {
        // Check if it's metadata display (Priority, Default) - these are OK
        const isMetadata = /Priority:|Default|isDefault/.test(trimmedLine);
        
        if (!isMetadata) {
          violations.push({
            file: filePath,
            line: lineNum,
            content: trimmedLine,
            reason: 'Using Badge component for tier display instead of SitterTierBadge',
          });
        }
      }
    }

    // Check for Badge with tier.name in children/content
    // Pattern: <Badge>...tier.name...</Badge> or similar
    if (
      trimmedLine.includes('<Badge') &&
      (trimmedLine.includes('tier.name') ||
       trimmedLine.includes('currentTier.name') ||
       trimmedLine.includes('sitterTier.name'))
    ) {
      if (!trimmedLine.includes('SitterTierBadge')) {
        violations.push({
          file: filePath,
          line: lineNum,
          content: trimmedLine,
          reason: 'Displaying tier name in Badge instead of using SitterTierBadge',
        });
      }
    }

    // Check for Badge component instantiation with tier props
    // Pattern: Badge({...tier...}) or new Badge(...)
    if (
      (trimmedLine.includes('Badge(') || trimmedLine.includes('Badge[')) &&
      (trimmedLine.includes('tier') ||
       trimmedLine.includes('currentTier') ||
       trimmedLine.includes('sitterTier')) &&
      !trimmedLine.includes('SitterTierBadge')
    ) {
      violations.push({
        file: filePath,
        line: lineNum,
        content: trimmedLine,
        reason: 'Using Badge component for tier display instead of SitterTierBadge',
      });
    }
  });
}

function scanDirectory(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldExclude(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      scanFile(fullPath);
    }
  }
}

// Main execution
const srcDir = path.join(process.cwd(), 'src');
console.log('🔍 Scanning for tier badge violations...\n');
scanDirectory(srcDir);

// Report results
if (violations.length === 0) {
  console.log('✅ No violations found! All tier displays use SitterTierBadge component.\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${violations.length} violation(s):\n`);
  violations.forEach((violation, index) => {
    console.log(`${index + 1}. ${violation.file}:${violation.line}`);
    console.log(`   Reason: ${violation.reason}`);
    console.log(`   Content: ${violation.content}`);
    console.log('');
  });
  console.log('\n❌ AUDIT FAILED: Fix violations before proceeding.\n');
  process.exit(1);
}
