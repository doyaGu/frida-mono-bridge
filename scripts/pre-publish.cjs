#!/usr/bin/env node

/**
 * Pre-publish validation script
 * Ensures package is ready for publication
 */

const fs = require('fs');
const path = require('path');

console.log('Running pre-publish checks...\n');

let hasErrors = false;

// Check 1: Ensure dist/index.js exists (library output)
const distIndexPath = path.join(__dirname, '..', 'dist', 'index.js');
if (!fs.existsSync(distIndexPath)) {
  console.error('[ERROR] dist/index.js not found. Run `npm run build` first.');
  hasErrors = true;
} else {
  console.log('[OK] dist/index.js exists (library entry point)');
}

// Check 2: Ensure dist/index.d.ts exists (type declarations)
const distDtsPath = path.join(__dirname, '..', 'dist', 'index.d.ts');
if (!fs.existsSync(distDtsPath)) {
  console.error('[ERROR] dist/index.d.ts not found. Run `npm run build` first.');
  hasErrors = true;
} else {
  console.log('[OK] dist/index.d.ts exists (type declarations)');
}

// Check 3: Verify package.json fields
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const requiredFields = ['name', 'version', 'description', 'license', 'repository', 'main'];
for (const field of requiredFields) {
  if (!pkg[field]) {
    console.error(`[ERROR] Missing required field in package.json: ${field}`);
    hasErrors = true;
  }
}

if (!hasErrors) {
  console.log('[OK] All package.json required fields present');
}

// Check 3: Verify version format
const versionRegex = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
if (!versionRegex.test(pkg.version)) {
  console.error(`[ERROR] Invalid version format: ${pkg.version}`);
  hasErrors = true;
} else {
  console.log(`[OK] Version format valid: ${pkg.version}`);
}

// Check 4: Verify essential files exist
const essentialFiles = ['README.md', 'LICENSE'];
for (const file of essentialFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] Missing essential file: ${file}`);
    hasErrors = true;
  }
}

if (!hasErrors) {
  console.log('[OK] All essential files present');
}

// Check 5: Check for common issues in files field
if (pkg.files) {
  console.log(`[OK] Files field configured with ${pkg.files.length} entries`);
} else {
  console.warn('[WARN] No files field in package.json - all files will be published');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('[FAILED] Pre-publish checks FAILED');
  console.error('Please fix the errors above before publishing.');
  process.exit(1);
} else {
  console.log('[PASSED] All pre-publish checks PASSED');
  console.log('\nReady to publish! Run:');
  console.log('  npm publish --dry-run  (to preview)');
  console.log('  npm publish            (to publish)');
}
