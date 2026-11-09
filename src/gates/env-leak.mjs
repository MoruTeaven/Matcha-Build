import fs from 'node:fs/promises';
import path from 'node:path';
import { isTextFile, walkFiles } from '../utils/fs.mjs';

const SENSITIVE_KEY = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i;
const SAFE_PREFIX = /^(VITE_|APP_|PUBLIC_)/;

/**
 * 环境变量泄漏：产物里不应出现敏感环境变量的值。
 * 只看 KEY/TOKEN/SECRET/PASSWORD 类变量，且排除 VITE_/APP_ 白名单前缀。
 */
export const envLeakGate = {
  id: 'env-leak',
  async check(target) {
    const sensitive = Object.entries(process.env)
      .filter(([key, value]) => value && value.length >= 8 && SENSITIVE_KEY.test(key) && !SAFE_PREFIX.test(key))
      .map(([key, value]) => ({ key, value }));

    if (sensitive.length === 0) return '无敏感环境变量需要检查';

    const files = await walkFiles(target.outDirAbs, isTextFile);
    const hits = [];

    for (const file of files) {
      const text = await fs.readFile(file, 'utf-8');
      for (const { key, value } of sensitive) {
        if (text.includes(value)) {
          hits.push(`${path.relative(target.outDirAbs, file).split(path.sep).join('/')} 含 ${key} 的值`);
        }
      }
    }

    if (hits.length > 0) throw new Error(`环境变量泄漏：${hits.slice(0, 5).join(', ')}`);
    return `${sensitive.length} 个敏感变量未泄漏`;
  },
};
