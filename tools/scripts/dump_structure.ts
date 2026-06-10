import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

// Dynamically determine the workspace root directory relative to this script
const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(__dirname, '../..');

// Folders/files to ignore (generated, dependency, build or not created by us)
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  '.next',
  '.output',
  'bun.lock',
  'package-lock.json',
  'yarn.lock',
  'tmp',
  'reference',
  'references',
  'research',
  'docs',
  'tools',
  '.gemini',
  'packages/db/drizzle/meta',
];

interface FileInfo {
  path: string;
  lines: number;
}

function shouldIgnore(path: string): boolean {
  const relPath = relative(WORKSPACE_ROOT, path);
  return IGNORE_PATTERNS.some(pattern => 
    relPath === pattern || 
    relPath.startsWith(pattern + '/') || 
    relPath.split('/').includes(pattern)
  );
}

const allFiles: FileInfo[] = [];

function countLines(content: string): number {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function traverse(dir: string, depth = 0, prefix = '') {
  if (shouldIgnore(dir)) return;

  const items = readdirSync(dir).sort();
  
  items.forEach((item, index) => {
    const fullPath = join(dir, item);
    if (shouldIgnore(fullPath)) return;

    const isLast = index === items.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      console.log(`${prefix}${marker}${item}/`);
      traverse(fullPath, depth + 1, nextPrefix);
    } else {
      try {
        const textContent = readFileSync(fullPath, 'utf8');
        const lines = countLines(textContent);
        const rel = relative(WORKSPACE_ROOT, fullPath);
        allFiles.push({ path: rel, lines });
        console.log(`${prefix}${marker}${item} (${lines} lines)`);
      } catch (err) {
        console.log(`${prefix}${marker}${item} (error reading lines)`);
      }
    }
  });
}

console.log('==================================================');
console.log('   HARGIA - REPOSITORY STRUCTURE & LINE COUNTS    ');
console.log('==================================================');
console.log('harga-indo/');
traverse(WORKSPACE_ROOT);

console.log('\n==================================================');
console.log('   TOP 5 LARGEST SOURCE FILES (BY LINE COUNT)     ');
console.log('==================================================');
const sortedFiles = [...allFiles].sort((a, b) => b.lines - a.lines);
sortedFiles.slice(0, 5).forEach((file, index) => {
  console.log(`${index + 1}. [${file.path}](file://${join(WORKSPACE_ROOT, file.path)}) - ${file.lines} lines`);
});
