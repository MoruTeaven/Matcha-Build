import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.html', '.htm', '.css', '.json', '.txt', '.md', '.log',
  '.xml', '.svg', '.map', '.wxml', '.wxss', '.wxs',
]);

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function walkFiles(dir, predicate = () => true) {
  const files = [];

  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && predicate(full)) files.push(full);
    }
  }

  if (existsSync(dir)) await visit(dir);
  return files.sort();
}

export function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

export async function hashFile(file) {
  const content = await fs.readFile(file);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** 对一组文件做稳定哈希：按相对路径排序后依次累加路径与内容 */
export async function hashFiles(dir, files) {
  const hash = crypto.createHash('sha256');
  for (const file of [...files].sort()) {
    const relative = path.relative(dir, file).split(path.sep).join('/');
    hash.update(relative);
    hash.update(await fs.readFile(file));
  }
  return hash.digest('hex');
}

export async function copyFileSafe(from, to) {
  await ensureDir(path.dirname(to));
  await fs.copyFile(from, to);
}

export async function readText(file) {
  return fs.readFile(file, 'utf-8');
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}
