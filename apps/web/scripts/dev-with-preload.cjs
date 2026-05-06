#!/usr/bin/env node

/**
 * Dev script with preload capability for Next.js
 * Allows environment setup before starting dev server
 */

const { spawn } = require('child_process');
const path = require('path');

// Get arguments passed to this script
const args = process.argv.slice(2);

// Spawn next dev with the provided arguments
// Run from the web app root, not the scripts directory
const webAppRoot = path.join(__dirname, '..');
const child = spawn('next', args, {
  cwd: webAppRoot,
  stdio: 'inherit',
  shell: true,
});

// Pass through exit code
child.on('exit', (code) => {
  process.exit(code);
});
