import pc from 'picocolors';

let currentTarget = null;

export function setTarget(name) {
  currentTarget = name;
}

function prefix() {
  return currentTarget ? pc.dim(`[${currentTarget}]`) + ' ' : '';
}

export const log = {
  info(message) {
    console.log(`${prefix()}${message}`);
  },
  step(message) {
    console.log(`${prefix()}${pc.cyan('›')} ${message}`);
  },
  success(message) {
    console.log(`${prefix()}${pc.green('✓')} ${message}`);
  },
  warn(message) {
    console.warn(`${prefix()}${pc.yellow('!')} ${message}`);
  },
  error(message) {
    console.error(`${prefix()}${pc.red('✗')} ${message}`);
  },
  dim(message) {
    console.log(`${prefix()}${pc.dim(message)}`);
  },
  plain(message) {
    console.log(message);
  },
};

export function banner(title, subtitle) {
  const line = pc.dim('─'.repeat(Math.max(24, title.length + 12)));
  console.log('');
  console.log(`${pc.bold(pc.green('matcha'))} ${title}`);
  if (subtitle) console.log(pc.dim(subtitle));
  console.log(line);
}
