import fs from 'node:fs/promises';
import path from 'node:path';
import { isTextFile, walkFiles } from '../utils/fs.mjs';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 产物里不应出现 core 的源码痕迹：
 * - 未解析的 `@mocha/core` 导入
 * - 被重写的 `../core/src/` 路径
 * - 源码里的绝对路径
 */
export const noCoreLeakGate = {
  id: 'no-core-leak',
  async check(target, ctx) {
    const alias = ctx.config.core.alias;
    const checks = [
      { name: `未解析的 ${alias}`, pattern: new RegExp(escapeRegExp(alias)) },
      { name: '../core/src/ 重写痕迹', pattern: /\.\.\/core\/src\// },
    ];

    const files = await walkFiles(target.outDirAbs, isTextFile);
    const hits = [];

    for (const file of files) {
      const text = await fs.readFile(file, 'utf-8');
      for (const check of checks) {
        if (check.pattern.test(text)) {
          hits.push(`${path.relative(target.outDirAbs, file).split(path.sep).join('/')}（${check.name}）`);
        }
      }
    }

    if (hits.length > 0) throw new Error(`core 源码泄漏：${hits.slice(0, 5).join(', ')}${hits.length > 5 ? ` 等 ${hits.length} 处` : ''}`);
    return `${files.length} 个文本文件无 core 泄漏`;
  },
};
