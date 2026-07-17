import { readFile, writeFile } from 'node:fs/promises';

const generatedWorkerUrl = new URL('./.generated-worker.js', import.meta.url);
const unsupportedIterations = '160000';
const supportedIterations = '100000';

let source = await readFile(generatedWorkerUrl, 'utf8');
source = source.replaceAll(unsupportedIterations, supportedIterations);

if (source.includes(unsupportedIterations)) {
  throw new Error('Unsupported PBKDF2 iteration count remains in generated Worker');
}

await writeFile(generatedWorkerUrl, source, 'utf8');
console.log(`Normalized PBKDF2 iterations to ${supportedIterations}`);
