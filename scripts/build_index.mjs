#!/usr/bin/env node
/**
 * Build MiniSearch index — sérialise un index pré-construit.
 * Note : MiniSearch côté client reconstruit l'index à partir des search-docs.json,
 * donc ce script est optionnel (utile si on veut pré-sérialiser pour accélérer).
 *
 * Usage : node scripts/build_index.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// Vérifier que les fichiers existent
const searchDocsPath = join(dataDir, 'search-docs.json');
const metaPath = join(dataDir, 'meta.json');

try {
  const docs = JSON.parse(readFileSync(searchDocsPath, 'utf-8'));
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  console.log(`Loaded ${docs.length} search documents`);
  console.log(`Generated at: ${meta.generatedAt}`);
  console.log(`Total companies: ${meta.totalCompanies}`);
  console.log(`Total chunks: ${meta.totalChunks}`);
  console.log('\nIndex will be built client-side via MiniSearch CDN.');
  console.log('All data files are ready for deployment.');

} catch (err) {
  console.error('Error:', err.message);
  console.error('Run preprocess.py first to generate the data files.');
  process.exit(1);
}
