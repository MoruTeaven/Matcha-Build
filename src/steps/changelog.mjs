import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir } from '../utils/fs.mjs';
import { log } from '../utils/log.mjs';

/**
 * 更新日志按端裁剪（BUILD-SPEC §7.1）：
 *
 * 源：仓库根 CHANGELOG.md（单一真相源，给人看的版本在仓库）。
 * 条目行开头可带端标签，如 `- [web] 修复…`、`- [web,taro] …`；
 * `[全端]` 或不带标签 = 全端可见（老格式零迁移）。
 * 条目可在端标签后带日期前缀：`- [web] (2026-11-11) 内容`（省略 = 版本节日期）。
 * 未知端名直接报错（防拼错静默丢失）。
 *
 * 产物：dist/<target>/changelog.json——给软件加载（更新日志页/弹窗直接渲染），
 * 只含该端可见条目（端标签已裁剪），日期独立成字段：
 * { versions: [{ version, date, items: [{ date?, text }] }] }
 */

/** 条目行的端标签：`- [web,taro] 内容` */
const TAGGED_ITEM = /^(\s*-\s*)\[([^\]]*)\]\s*/;

/** 标签内分隔符：中英文逗号、顿号、空白 */
const TAG_SPLIT = /[,，、\s]+/;

/** 版本节标题：`## 0.1.0-dev.1 — 2026-11-11`（破折号兼容 em dash / 连字符） */
const VERSION_HEADING = /^##\s+(\S+)\s+[—-]\s+(\S+)/;

/** 条目文本的日期前缀：`(2026-11-10) 内容` */
const DATE_PREFIX = /^\((\d{4}-\d{2}-\d{2})\)\s*/;

export async function applyChangelog(target, ctx) {
  // 端级开关（weapp 等对包体积敏感的端可关）
  if (target.changelog === false) return;

  const source = path.join(ctx.rootDir, 'CHANGELOG.md');
  if (!existsSync(source)) return; // 项目没有更新日志就不生成（matcha 不强制）

  const raw = await fs.readFile(source, 'utf-8');
  const validTags = new Set([...Object.keys(ctx.config.targets), '全端']);

  const versions = []; // 结构化产物（changelog.json）
  let current = null;
  let seenVersionHeading = false;

  for (const line of raw.split(/\r?\n/)) {
    if (/^##\s/.test(line)) seenVersionHeading = true;
    // 版本节之前的引用块（`> `）是写给开发者的格式定义，不属于任何版本
    if (!seenVersionHeading && line.startsWith('>')) continue;

    // 版本节标题：进入新版本，开始收集结构化条目
    const heading = line.match(VERSION_HEADING);
    if (heading) {
      current = { version: heading[1], date: heading[2], items: [] };
      versions.push(current);
      continue;
    }

    // 条目行：带端标签（- [web] …）或不带（- …）都视为条目
    const match = line.match(TAGGED_ITEM);
    if (!match && !/^\s*-\s+/.test(line)) continue; // 正文等非条目行不进产物

    // 解析端标签决定可见性（无标签 = 全端）
    if (match) {
      const tags = match[2].split(TAG_SPLIT).filter(Boolean);
      if (tags.length > 0) {
        const unknown = tags.filter((tag) => !validTags.has(tag));
        if (unknown.length > 0) {
          throw new Error(
            `CHANGELOG 条目端标签未知：${unknown.join(' / ')}（可用：${[...validTags].join(' / ')}）\n  ${line.trim()}`,
          );
        }
        const visible = tags.includes('全端') || tags.includes(target.id);
        if (!visible) continue; // 该端不可见：不进产物
      }
    }

    // 结构化：剥掉标签与日期前缀，日期独立成字段
    const text = line.replace(TAGGED_ITEM, '$1').replace(/^\s*-\s*/, '');
    const dateMatch = text.match(DATE_PREFIX);
    if (current) {
      current.items.push(
        dateMatch
          ? { date: dateMatch[1], text: text.slice(dateMatch[0].length) }
          : { text },
      );
    }
  }

  const jsonFile = path.join(target.outDirAbs, 'changelog.json');
  await ensureDir(target.outDirAbs);
  await fs.writeFile(jsonFile, `${JSON.stringify({ versions }, null, 2)}\n`, 'utf-8');
  log.dim('  + changelog.json（按端裁剪）');
}
