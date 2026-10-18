import { execSync } from 'node:child_process';
import { packageCrx } from './pack_crx.mjs';

try {
  console.log('Building Stabs extension package (ZIP)...');
  execSync('python scripts/package.py', { stdio: 'inherit' });

  console.log('Building signed CRX package...');
  await packageCrx();
} catch (err) {
  console.error('Packaging failed:', err.message);
  process.exit(1);
}
