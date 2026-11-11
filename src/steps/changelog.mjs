import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir } from '../utils/fs.mjs';
import { log } from '../utils/log.mjs';

/**
 * 更新日志按端裁剪（BUILD-SPEC §4）：
 *
 * 源：仓库根 CHANGELOG.md（单一真相源）。
 * 条目行开头可带端标签，如 `- [web] 修复…`、`- [web,taro] …`；
 * `[全端]` 或不带标签 = 全端可见（老格式零迁移）。
 * 未知端名直接报错（防拼错静默丢失）。
 *
 * 产物：dist/<target>/CHANGELOG.md——只含该端可见条目，标签剥掉
 * （用户看到的日志不带内部元数据）。版本标题/日期行原样保留。
 */

/** 条目行的端标签：`- [web,taro] 内容` */
const TAGGED_ITEM = /^(\s*-\s*)\[([^\]]*)\]\s*/;

/** 标签内分隔符：中英文逗号、顿号、空白 */
const TAG_SPLIT = /[,，、\s]+/;

export async function applyChangelog(target, ctx) {
  // 端级开关（weapp 等对包体积敏感的端可关）
  if (target.changelog === false) return;

  const source = path.join(ctx.rootDir, 'CHANGELOG.md');
  if (!existsSync(source)) return; // 项目没有更新日志就不生成（matcha 不强制）

  const raw = await fs.readFile(source, 'utf-8');
  const validTags = new Set([...Object.keys(ctx.config.targets), '全端']);

  const lines = raw.split(/\r?\n/);
  const kept = [];
  let seenVersionHeading = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) seenVersionHeading = true;
    // 版本节之前的引用块（`> `）是写给开发者的格式定义，不进端用户产物
    if (!seenVersionHeading && line.startsWith('>')) continue;

    const match = line.match(TAGGED_ITEM);
    if (!match) {
      kept.push(line); // 版本标题、日期、正文等原样保留
      continue;
    }

    const tags = match[2].split(TAG_SPLIT).filter(Boolean);
    if (tags.length === 0) {
      kept.push(line); // `[]` 空标签视为无标签（全端）
      continue;
    }

    const unknown = tags.filter((tag) => !validTags.has(tag));
    if (unknown.length > 0) {
      throw new Error(
        `CHANGELOG 条目端标签未知：${unknown.join(' / ')}（可用：${[...validTags].join(' / ')}）\n  ${line.trim()}`,
      );
    }

    if (tags.includes('全端') || tags.includes(target.id)) {
      // 保留该条，剥掉标签——产物日志不带内部元数据
      kept.push(line.replace(TAGGED_ITEM, '$1'));
    }
  }

  const outFile = path.join(target.outDirAbs, 'CHANGELOG.md');
  await ensureDir(target.outDirAbs);
  await fs.writeFile(outFile, `${kept.join('\n').trimEnd()}\n`, 'utf-8');
  log.dim('  + CHANGELOG.md（按端裁剪）');
}
