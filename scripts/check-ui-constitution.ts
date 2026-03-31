#!/usr/bin/env tsx
/**
 * UI Constitution Enforcement - Hardcoded Values Checker
 * 
 * Option A: Changed-file enforcement (preferred)
 * - In CI: Only fails on violations in changed files
 * - Legacy violations are reported but non-blocking
 * - Local: Checks all files for full visibility
 * 
 * Checks src/app/** files for violations:
 * - Hardcoded px, rem, %, vh, vw, hex, rgba values
 * - Overflow/overflow-y/overflow-auto outside approved components
 * - Tailwind layout classes used directly in pages
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, relative } from 'path';

const VIOLATIONS: Array<{ file: string; line: number; message: string }> = [];
const LEGACY_VIOLATIONS: Array<{ file: string; line: number; message: string }> = [];

// Detect if we're in CI and get changed files
const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

function getChangedFiles(): Set<string> | null {
  if (!IS_CI) {
    return new Set(); // In local mode, check all files for visibility
  }
  
  try {
    let changedFiles: string[] = [];
    
    // In GitHub Actions, check for PR context first
    if (process.env.GITHUB_BASE_REF && process.env.GITHUB_HEAD_REF) {
      // PR context: compare base to head
      try {
        changedFiles = execSync(
          `git diff --name-only --diff-filter=ACMR origin/${process.env.GITHUB_BASE_REF}...HEAD`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
        )
          .trim()
          .split('\n')
          .filter(Boolean);
      } catch (e) {
        // If origin branches not available, try local branches
        try {
          changedFiles = execSync(
            `git diff --name-only --diff-filter=ACMR ${process.env.GITHUB_BASE_REF}...HEAD`,
            { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
          )
            .trim()
            .split('\n')
            .filter(Boolean);
        } catch (e2) {
          // Fall through to push event logic
        }
      }
    }
    
    // If no PR context or PR detection failed, try push event logic
    if (changedFiles.length === 0) {
      try {
        // For push events, compare previous commit
        const eventName = process.env.GITHUB_EVENT_NAME || '';
        if (eventName === 'push') {
          let beforeSha = process.env.GITHUB_EVENT_BEFORE || 'HEAD~1';
          const afterSha = process.env.GITHUB_SHA || 'HEAD';
          // Initial push: GITHUB_EVENT_BEFORE is zero sha; avoid diffing entire repo
          if (/^0+$/.test(beforeSha)) beforeSha = 'HEAD~1';
          changedFiles = execSync(
            `git diff --name-only --diff-filter=ACMR ${beforeSha}...${afterSha}`,
            { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
          )
            .trim()
            .split('\n')
            .filter(Boolean);
        } else {
          // Last resort: compare HEAD~1 to HEAD
          changedFiles = execSync('git diff --name-only --diff-filter=ACMR HEAD~1 HEAD', {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe']
          })
            .trim()
            .split('\n')
            .filter(Boolean);
        }
      } catch (e) {
        // If all else fails, return null to indicate unknown (will treat as non-blocking)
        console.warn('⚠️  Could not determine changed files from git, treating violations as non-blocking');
        return null;
      }
    }
    
    // Filter to only src/app/** files and normalize paths
    const appFiles = changedFiles
      .filter(file => file.startsWith('src/app/'))
      .map(file => file.replace(/\\/g, '/')); // Normalize path separators
    
    return new Set(appFiles);
  } catch (error) {
    console.warn('⚠️  Could not determine changed files, treating violations as non-blocking:', (error as Error).message);
    return null; // Return null to indicate unknown (non-blocking)
  }
}

const CHANGED_FILES = getChangedFiles();

// Approved components that can use overflow
const APPROVED_OVERFLOW_COMPONENTS = [
  'Modal',
  'Drawer',
  'BottomSheet',
  'Toast',
  'Table',
  'DataTable',
  'CardList',
];

// Approved overflow usage patterns
const APPROVED_OVERFLOW_PATTERNS = [
  /overflow-x:\s*hidden/, // Horizontal overflow prevention is OK
  /overflow:\s*hidden/, // In global styles
  /overflow-wrap/, // Text wrapping
  /word-wrap/, // Text wrapping
];

// Hardcoded value patterns to check
const HARDCODED_PATTERNS = [
  // Units
  /\b\d+px\b(?!['"])/g,  // px values (excluding strings)
  /\b\d+rem\b(?!['"])/g,  // rem values
  /\b\d+%\b(?!['"])/g,    // % values (excluding strings)
  /\b\d+vh\b(?!['"])/g,   // vh values
  /\b\d+vw\b(?!['"])/g,   // vw values
  // Colors
  /#[0-9a-fA-F]{3,6}\b(?!['"])/g,  // hex colors (excluding strings)
  /rgba?\([^)]+\)/g,  // rgba/rgb functions
];

// Tailwind layout classes to flag
const TAILWIND_LAYOUT_CLASSES = [
  'container',
  'mx-auto',
  'flex',
  'grid',
  'block',
  'inline-block',
  'hidden',
  'absolute',
  'relative',
  'fixed',
  'sticky',
];

function checkFile(filePath: string, relativePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Determine if this is a changed file (in CI) or legacy file
  // If CHANGED_FILES is null (unknown), treat all as legacy (non-blocking)
  const isChangedFile = !IS_CI || (CHANGED_FILES !== null && CHANGED_FILES.size > 0 && CHANGED_FILES.has(relativePath));
  const isLegacyFile = relativePath.includes('-legacy') || 
                       relativePath.includes('page-old') || 
                       relativePath.includes('-backup') ||
                       relativePath.includes('/legacy/');
  
  // Skip if it's an approved component
  const isApprovedComponent = APPROVED_OVERFLOW_COMPONENTS.some(comp => 
    relativePath.includes(`components/ui/${comp}`) || 
    relativePath.includes(`components/${comp}`)
  );
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments and strings
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
      return;
    }
    
    // Check for hardcoded values (but skip in string literals and comments)
    HARDCODED_PATTERNS.forEach((pattern, patternIndex) => {
      const matches = line.match(pattern);
      if (matches) {
        // Check if it's in a string literal or comment
        const beforeMatch = line.substring(0, line.indexOf(matches[0]));
        const inString = (beforeMatch.match(/['"`]/g) || []).length % 2 !== 0;
        const inComment = beforeMatch.includes('//') || beforeMatch.includes('/*');
        
        if (!inString && !inComment) {
          // Allow some exceptions:
          // - In design-tokens.ts (source of truth)
          // - In globals.css (CSS variable definitions)
          // - In tailwind.config.js (config)
          if (!relativePath.includes('design-tokens') && 
              !relativePath.includes('globals.css') && 
              !relativePath.includes('tailwind.config')) {
            const patternNames = ['px', 'rem/%/vh/vw', 'hex', 'rgba/rgb'];
            const violation = {
              file: relativePath,
              line: lineNum,
              message: `Hardcoded ${patternNames[patternIndex] || 'value'} found: ${matches[0]}. Use tokens instead.`,
            };
            
            // Only fail on changed files (and not legacy)
            // If CHANGED_FILES is null (unknown), treat as legacy (non-blocking)
            if (isChangedFile && !isLegacyFile) {
              VIOLATIONS.push(violation);
            } else {
              LEGACY_VIOLATIONS.push(violation);
            }
          }
        }
      }
    });
    
    // Check for overflow violations (only in src/app/**)
    if (relativePath.startsWith('src/app/')) {
      if (/\boverflow(-y|-x)?(-auto|-hidden|-scroll)?\s*:/.test(line)) {
        const isApprovedPattern = APPROVED_OVERFLOW_PATTERNS.some(pattern => pattern.test(line));
        const isApprovedFile = isApprovedComponent;
        
        if (!isApprovedPattern && !isApprovedFile) {
          const violation = {
            file: relativePath,
            line: lineNum,
            message: 'Overflow property found outside approved components. Use UI kit components instead.',
          };
          
          if (isChangedFile && !isLegacyFile) {
            VIOLATIONS.push(violation);
          } else {
            LEGACY_VIOLATIONS.push(violation);
          }
        }
      }
    }
    
    // Check for Tailwind layout classes in pages (only in src/app/**/page.tsx)
    if (relativePath.match(/src\/app\/[^/]+\/page\.tsx?$/)) {
      TAILWIND_LAYOUT_CLASSES.forEach(className => {
        if (new RegExp(`["'\`]${className}["'\`]`).test(line) || 
            new RegExp(`className.*${className}`).test(line)) {
          const violation = {
            file: relativePath,
            line: lineNum,
            message: `Tailwind layout class "${className}" found. Use UI kit components instead.`,
          };
          
          if (isChangedFile && !isLegacyFile) {
            VIOLATIONS.push(violation);
          } else {
            LEGACY_VIOLATIONS.push(violation);
          }
        }
      });
    }
  });
}

function walkDirectory(dir: string, baseDir: string) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = relative(baseDir, fullPath);
    const stat = statSync(fullPath);
    
    // Skip node_modules, .next, etc.
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '.next' || entry === 'dist') {
      continue;
    }
    
    if (stat.isDirectory()) {
      walkDirectory(fullPath, baseDir);
    } else if (stat.isFile() && (entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.css'))) {
      // Only check src/app/** files for violations
      if (relativePath.startsWith('src/app/')) {
        checkFile(fullPath, relativePath);
      }
    }
  }
}

// Main execution
const srcDir = join(process.cwd(), 'src');
const appDir = join(srcDir, 'app');

console.log('🔍 Checking UI Constitution violations...\n');

if (IS_CI && CHANGED_FILES !== null && CHANGED_FILES.size > 0) {
  console.log(`📝 CI mode: Checking ${CHANGED_FILES.size} changed file(s) for violations\n`);
  console.log('Changed files:', Array.from(CHANGED_FILES).join(', '), '\n');
} else if (IS_CI && CHANGED_FILES === null) {
  console.log('📝 CI mode: Could not determine changed files - treating all violations as non-blocking\n');
} else if (IS_CI) {
  console.log('📝 CI mode: Checking all files (could not determine changed files)\n');
} else {
  console.log('💻 Local mode: Checking all files for full visibility\n');
}

try {
  walkDirectory(appDir, process.cwd());
  
  // Report legacy violations (non-blocking)
  if (LEGACY_VIOLATIONS.length > 0) {
    console.log(`ℹ️  Found ${LEGACY_VIOLATIONS.length} legacy violation(s) (non-blocking):\n`);
    LEGACY_VIOLATIONS.forEach(v => {
      console.log(`  [LEGACY] ${v.file}:${v.line}`);
      console.log(`    ${v.message}\n`);
    });
  }
  
  // Report and fail on active violations
  if (VIOLATIONS.length === 0) {
    if (LEGACY_VIOLATIONS.length > 0) {
      console.log(`✅ No violations in changed files! (${LEGACY_VIOLATIONS.length} legacy violations remain)\n`);
    } else {
      console.log('✅ No UI Constitution violations found!\n');
    }
    process.exit(0);
  } else {
    console.error(`❌ Found ${VIOLATIONS.length} UI Constitution violation(s) in changed files:\n`);
    VIOLATIONS.forEach(v => {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.message}\n`);
    });
    if (LEGACY_VIOLATIONS.length > 0) {
      console.error(`\n⚠️  Note: ${LEGACY_VIOLATIONS.length} legacy violations exist but are non-blocking.\n`);
    }
    process.exit(1);
  }
} catch (error) {
  console.error('Error checking files:', error);
  process.exit(1);
}
