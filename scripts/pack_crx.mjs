/**
 * Stabs CRX3 Extension Packager
 * Generates an officially signed CRX3 package from the extension ZIP archive.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const keyPath = path.join(rootDir, 'scripts', 'developer_key.pem');

// Helper to encode unsigned integer as protobuf varint
function encodeVarint(val) {
  const bytes = [];
  let current = val;
  while (current > 127) {
    bytes.push((current & 127) | 128);
    current >>>= 7;
  }
  bytes.push(current & 127);
  return Buffer.from(bytes);
}

// Helper to encode length-delimited protobuf field
function encodeLengthDelimited(fieldNumber, data) {
  const tag = (fieldNumber << 3) | 2;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([encodeVarint(tag), encodeVarint(buf.length), buf]);
}

export async function packageCrx() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Load manifest for version
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const version = manifest.version || '1.0.0';
  const zipName = `stabs-v${version}.zip`;
  const crxName = `stabs-v${version}.crx`;
  const zipPath = path.join(distDir, zipName);
  const crxPath = path.join(distDir, crxName);

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip archive not found at ${zipPath}. Run build.mjs first.`);
  }

  const zipBuffer = fs.readFileSync(zipPath);

  // Load or generate 2048-bit RSA private key
  let privateKeyPem;
  if (fs.existsSync(keyPath)) {
    privateKeyPem = fs.readFileSync(keyPath, 'utf8');
  } else {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKeyPem = keyPair.privateKey;
    fs.writeFileSync(keyPath, privateKeyPem, 'utf8');
    console.log(`Generated new private key at ${path.relative(rootDir, keyPath)}`);
  }

  const privateKeyObj = crypto.createPrivateKey(privateKeyPem);
  const publicKeyObj = crypto.createPublicKey(privateKeyObj);
  const derPublicKey = publicKeyObj.export({ type: 'spki', format: 'der' });

  // Calculate 16-byte crx_id from first 16 bytes of sha256(derPublicKey)
  const crxId = crypto.createHash('sha256').update(derPublicKey).digest().subarray(0, 16);

  // SignedData protobuf message (field 1: crx_id)
  const signedHeaderData = encodeLengthDelimited(1, crxId);

  // Signature calculation:
  // "CRX3 SignedData\x00" + uint32_le(signedHeaderData.length) + signedHeaderData + zipBuffer
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32LE(signedHeaderData.length, 0);

  const dataToSign = Buffer.concat([
    Buffer.from('CRX3 SignedData\0', 'utf8'),
    lengthBuf,
    signedHeaderData,
    zipBuffer
  ]);

  const signature = crypto.sign('RSA-SHA256', dataToSign, privateKeyObj);

  // AsymmetricKeyProof protobuf (field 1: public_key, field 2: signature)
  const asymmetricKeyProof = Buffer.concat([
    encodeLengthDelimited(1, derPublicKey),
    encodeLengthDelimited(2, signature)
  ]);

  // CrxFileHeader protobuf:
  // field 2: sha256_with_rsa (repeated AsymmetricKeyProof)
  // field 10000: signed_header_data (bytes)
  const crxFileHeader = Buffer.concat([
    encodeLengthDelimited(2, asymmetricKeyProof),
    encodeLengthDelimited(10000, signedHeaderData)
  ]);

  // Magic 'Cr24' (0x43, 0x72, 0x32, 0x34)
  const magic = Buffer.from('Cr24', 'utf8');

  // Version 3 (uint32 LE)
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(3, 0);

  // Header length (uint32 LE)
  const headerLengthBuf = Buffer.alloc(4);
  headerLengthBuf.writeUInt32LE(crxFileHeader.length, 0);

  // Complete CRX3 file
  const crxBuffer = Buffer.concat([
    magic,
    versionBuf,
    headerLengthBuf,
    crxFileHeader,
    zipBuffer
  ]);

  fs.writeFileSync(crxPath, crxBuffer);

  const sha256 = crypto.createHash('sha256').update(crxBuffer).digest('hex');
  const sizeKb = (crxBuffer.length / 1024).toFixed(1);

  console.log(`Successfully built ${path.relative(rootDir, crxPath)} (${sizeKb} KB).`);
  console.log(`CRX SHA-256: ${sha256}`);

  return {
    crxPath,
    sha256,
    sizeKb
  };
}

// Direct execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  packageCrx().catch(err => {
    console.error('Failed to package CRX:', err);
    process.exit(1);
  });
}
