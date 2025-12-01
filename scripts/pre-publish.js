#!/usr/bin/env node

/**
 * Pre-publish validation script
 * Ensures package is ready for publication
 */

const fs = require('fs');
const path = require('path');

console.log('Running pre-publish checks...\n');

let hasErrors = false;

// Check 1: Ensure dist/agent.js exists
const agentPath = path.join(__dirname, '..', 'dist', 'agent.js');
if (!fs.existsSync(agentPath)) {
  console.error('[ERROR] dist/agent.js not found. Run `npm run build` first.');
  hasErrors = true;
} else {
  const stats = fs.statSync(agentPath);
  console.log(`[OK] dist/agent.js exists (${(stats.size / 1024).toFixed(2)} KB)`);
}

// Check 2: Verify package.json fields
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
