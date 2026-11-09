import fs from 'node:fs/promises';
import path from 'node:path';
import { isTextFile, walkFiles } from '../utils/fs.mjs';

/** 文本产物不得带 UTF-8 BOM（PowerShell 时代的老坑，Node 写出天然没有） */
export const bomGate = {
  id: 'bom',
  async check(target) {
    const files = await walkFiles(target.outDirAbs, isTextFile);
    const bad = [];

    for (const file of files) {
      const handle = await fs.open(file, 'r');
      const buffer = Buffer.alloc(3);
      const { bytesRead } = await handle.read(buffer, 0, 3, 0);
      await handle.close();
      if (bytesRead === 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        bad.push(path.relative(target.outDirAbs, file).split(path.sep).join('/'));
      }
    }

    if (bad.length > 0) throw new Error(`产物含 UTF-8 BOM：${bad.join(', ')}`);
    return `${files.length} 个文本文件无 BOM`;
  },
};
