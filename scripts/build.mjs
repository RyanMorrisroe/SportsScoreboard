import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

for (const relativePath of ['index.html', 'LICENSE']) {
  copyFileSync(join(root, relativePath), join(distDir, relativePath));
}

copyDirectory(join(root, 'src'), join(distDir, 'src'));

function copyDirectory(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir)) {
    const source = join(sourceDir, entry);
    const target = join(targetDir, entry);
    const isDirectory = statSync(source).isDirectory();

    if (isDirectory) {
      copyDirectory(source, target);
    } else {
      copyFileSync(source, target);
    }
  }
}
