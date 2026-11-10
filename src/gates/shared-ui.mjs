import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isTextFile, walkFiles } from '../utils/fs.mjs';

const BANNED_TAGS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'input',
  'textarea', 'select', 'option', 'ul', 'ol', 'li', 'a', 'img', 'picture',
  'section', 'main', 'nav', 'header', 'footer', 'aside', 'article',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'label', 'form',
  'svg', 'canvas', 'video', 'audio', 'iframe', 'br', 'hr',
]);

// JSX 开标签：<tag 后跟空白或 > 或 /
const JSX_TAG = /<([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
const REACT_DOM_IMPORT = /from\s+['"]react-dom(\/[\w./-]+)?['"]/;

/**
 * UI 契约门禁：core/src/ui 只许语义组件，禁止平台专属元素与 react-dom。
 * 依据 BUILD-SPEC §3.5——否则 Web 标签会原样进小程序包（实测编译期不报错）。
 */
export const sharedUiGate = {
  id: 'shared-ui-cross-platform',

  async check(_target, ctx) {
    const uiDir = path.join(ctx.config.core.rootAbs, 'ui');
    if (!existsSync(uiDir)) return 'core/ui 目录不存在，跳过';

    const files = await walkFiles(uiDir, isTextFile);
    const hits = [];

    for (const file of files) {
      const text = await fs.readFile(file, 'utf-8');
      const rel = path.relative(uiDir, file).split(path.sep).join('/');
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (REACT_DOM_IMPORT.test(line)) {
          hits.push(`${rel}:${index + 1}（import react-dom）`);
          return;
        }
        for (const match of line.matchAll(JSX_TAG)) {
          const tag = match[1];
          // JSX 规则：小写开头才是原生标签，<Button> 是我们的语义组件，合法
          if (tag === tag.toLowerCase() && BANNED_TAGS.has(tag)) {
            hits.push(`${rel}:${index + 1}（<${tag}>）`);
          }
        }
      });
    }

    if (hits.length > 0) {
      throw new Error(
        `core/src/ui 出现平台专属元素，请改用语义组件（见 BUILD-SPEC §3.5）：${hits.slice(0, 5).join(', ')}${hits.length > 5 ? ` 等 ${hits.length} 处` : ''}`,
      );
    }
    return `${files.length} 个 UI 源文件无平台专属元素`;
  },
};
