// ---------------------------------------------------------------------------
// Anikoto — zero-dependency HTML tree parser (used by AnikotoCzClient)
// ---------------------------------------------------------------------------

export type Tree = {
  tag: string;
  attrs: Record<string, string>;
  children: Tree[];
  content: string[];
};

function isSpace(value?: string): boolean {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t' || value === '\f';
}

function decodeNumericEntity(value: string): string | undefined {
  const hexadecimal = value[0]?.toLowerCase() === 'x';
  const digits = hexadecimal ? value.slice(1) : value;
  let code = 0;
  for (const character of digits.toLowerCase()) {
    const digit = hexadecimal
      ? '0123456789abcdef'.indexOf(character)
      : '0123456789'.indexOf(character);
    if (digit < 0) return undefined;
    code = code * (hexadecimal ? 16 : 10) + digit;
  }
  return code <= 0x10ffff ? String.fromCodePoint(code) : undefined;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',
  };
  let output = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] !== '&') {
      output += value[index++];
      continue;
    }
    const end = value.indexOf(';', index + 1);
    if (end < 0 || end - index > 12) {
      output += value[index++];
      continue;
    }
    const entity = value.slice(index + 1, end);
    const replacement = entity[0] === '#' ? decodeNumericEntity(entity.slice(1)) : named[entity];
    if (replacement === undefined) output += value.slice(index, end + 1);
    else output += replacement;
    index = end + 1;
  }
  return output;
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let index = 0;
  while (index < source.length && !isSpace(source[index]) && source[index] !== '/') index++;
  while (index < source.length) {
    while (isSpace(source[index]) || source[index] === '/') index++;
    const start = index;
    while (
      index < source.length &&
      !isSpace(source[index]) &&
      source[index] !== '=' &&
      source[index] !== '/'
    )
      index++;
    if (index === start) break;
    const name = source.slice(start, index).toLowerCase();
    while (isSpace(source[index])) index++;
    let value = '';
    if (source[index] === '=') {
      index++;
      while (isSpace(source[index])) index++;
      const quote = source[index] === '"' || source[index] === "'" ? source[index++] : '';
      const valueStart = index;
      if (quote) {
        while (index < source.length && source[index] !== quote) index++;
        value = source.slice(valueStart, index);
        index++;
      } else {
        while (index < source.length && !isSpace(source[index]) && source[index] !== '>') index++;
        value = source.slice(valueStart, index);
      }
    }
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

export function htmlTree(html: string): Tree {
  const root: Tree = { tag: 'root', attrs: {}, children: [], content: [] };
  const stack = [root];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) {
      stack[stack.length - 1].content.push(html.slice(index));
      break;
    }
    if (open > index) stack[stack.length - 1].content.push(html.slice(index, open));
    if (html.startsWith('<!--', open)) {
      const closeComment = html.indexOf('-->', open + 4);
      index = closeComment < 0 ? html.length : closeComment + 3;
      continue;
    }
    const close = html.indexOf('>', open + 1);
    if (close < 0) break;
    const source = html.slice(open + 1, close).trim();
    if (source.startsWith('/')) {
      const tag = source.slice(1).trim().split(' ')[0]?.toLowerCase();
      for (let cursor = stack.length - 1; cursor > 0; cursor--) {
        if (stack[cursor].tag === tag) {
          stack.length = cursor;
          break;
        }
      }
    } else if (source && !source.startsWith('!') && !source.startsWith('?')) {
      let splitAt = 0;
      while (splitAt < source.length && !isSpace(source[splitAt]) && source[splitAt] !== '/')
        splitAt++;
      const tag = source.slice(0, splitAt).toLowerCase();
      const node: Tree = { tag, attrs: parseAttrs(source), children: [], content: [] };
      stack[stack.length - 1].children.push(node);
      const selfClosing =
        source.endsWith('/') ||
        [
          'area',
          'base',
          'br',
          'col',
          'embed',
          'hr',
          'img',
          'input',
          'link',
          'meta',
          'param',
          'source',
          'track',
          'wbr',
        ].includes(tag);
      if (!selfClosing) stack.push(node);
    }
    index = close + 1;
  }
  return root;
}

export function descendants(node: Tree): Tree[] {
  const result: Tree[] = [];
  for (const child of node.children) {
    result.push(child, ...descendants(child));
  }
  return result;
}

export function hasClass(node: Tree, name: string): boolean {
  return (node.attrs.class ?? '').split(' ').includes(name);
}

function cleanTextStr(value: string): string {
  let output = '';
  let pendingSpace = false;
  for (const character of decodeEntities(value)) {
    if (isSpace(character)) {
      pendingSpace = output.length > 0;
    } else {
      if (pendingSpace) output += ' ';
      output += character;
      pendingSpace = false;
    }
  }
  return output;
}

export function textContent(node: Tree): string {
  return cleanTextStr([...node.content, ...node.children.map(textContent)].join(' '));
}
