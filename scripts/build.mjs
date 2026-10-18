import { execSync } from 'node:child_process';

try {
  console.log('Building Stabs extension package...');
  execSync('python scripts/package.py', { stdio: 'inherit' });
} catch (err) {
  console.error('Packaging failed:', err.message);
  process.exit(1);
}
