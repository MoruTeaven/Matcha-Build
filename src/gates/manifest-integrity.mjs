import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 平台清单完整性：plugin.json 的 main / preload / logo 必须指向产物内真实存在的文件，
 * 且 package.json 的 type 声明与 preload 的加载方式一致（commonjs）。
 */
export const manifestIntegrityGate = {
  id: 'manifest-integrity',
  async check(target) {
    const manifest = target.manifest;
    if (!manifest) return '该 target 无平台清单，跳过';

    const outDir = target.outDirAbs;
    const missing = [];

    for (const relative of manifest.require ?? []) {
      if (!existsSync(path.join(outDir, relative))) missing.push(relative);
    }

    const pluginJson = path.join(outDir, 'plugin.json');
    if (existsSync(pluginJson)) {
      const plugin = JSON.parse(await fs.readFile(pluginJson, 'utf-8'));
      for (const key of ['main', 'logo', 'preload']) {
        if (plugin[key] && !existsSync(path.join(outDir, plugin[key]))) missing.push(`${key} → ${plugin[key]}`);
      }
    }

    if (missing.length > 0) throw new Error(`清单引用缺失：${missing.join(', ')}`);

    const pkgJson = path.join(outDir, 'package.json');
    if (existsSync(pkgJson)) {
      const pkg = JSON.parse(await fs.readFile(pkgJson, 'utf-8'));
      if (pkg.type && pkg.type !== 'commonjs') {
        throw new Error(`产物 package.json 的 type 应为 commonjs，实际是 ${pkg.type}（preload.js 会被当 ESM 解析）`);
      }
    }

    return '清单引用完整';
  },
};
