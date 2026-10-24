import type { TranslationGroup } from '../types/translation';

// Legacy learning responses only. Structured API groups remain authoritative.
export function parseLegacyMeaning(raw: string): TranslationGroup[] | null {
  const normalized = raw.replace(/\\r\\n|\\n|\\r|\r\n|\r/g, '\n');
  const pos = '(?:interj|prefix|suffix|modal|conj|prep|pron|abbr|adv|adj|aux|art|det|num|int|pl|vt|vi|ad|n|v|a)\\.';
  const marker = new RegExp(`(^|[\\s;；])(${pos}(?:\\s*[&/]\\s*${pos})*)(?:[ \\t]+|(?=[^\\x00-\\x7F]))`, 'gi');
  const groups: TranslationGroup[] = [];
  let recognized = false;
  for (const line of normalized.split('\n')) {
    const matches = [...line.matchAll(marker)];
    if (!matches.length) {
      if (new RegExp(`^\\s*${pos}\\s*$`, 'i').test(line)) return null;
      if (professionalPrefix(line)) { groups.push({ partOfSpeech: null, meaning: line }); recognized = true; }
      else if (groups.length && (groups.at(-1)!.partOfSpeech !== null || professionalPrefix(groups.at(-1)!.meaning))) groups.at(-1)!.meaning += `\n${line}`;
      else if (line.length) groups.push({ partOfSpeech: null, meaning: line });
      continue;
    }
    const first = matches[0]!;
    const prefix = line.slice(0, first.index! + first[1]!.length);
    if (prefix.trim()) groups.push({ partOfSpeech: null, meaning: prefix });
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index]!;
      const next = matches[index + 1];
      const start = match.index! + match[0].length;
      const end = next ? next.index! + next[1]!.length : line.length;
      const meaning = line.slice(start, end);
      if (!meaning.trim()) return null; // Keep the entire original if any marker is incomplete.
      groups.push({ partOfSpeech: match[2]!, meaning });
      recognized = true;
    }
  }
  return recognized ? groups : null;
}

export function displayPartOfSpeech(value: string | null): string | null {
  return value?.replace(/(^|[\s/&])a\.(?=$|[\s/&])/gi, '$1adj.') ?? null;
}

export function professionalPrefix(meaning: string) {
  const match = meaning.match(/^\s*(\[[^\]\n]{1,20}\])[\t ]*/u);
  return match ? { label: match[1]!, length: match[0].length } : null;
}

// Every segment retains its separators. Joining them exactly restores the input.
// Parentheses and quoted text are indivisible; ambiguous punctuation stays whole.
export function splitMeaningItems(meaning: string): string[] {
  const pairs: Record<string, string> = { '(': ')', '（': '）', '[': ']', '【': '】', '“': '”', '「': '」', '『': '』', '"': '"' };
  const stack: string[] = [];
  const items: string[] = [];
  let start = 0;
  for (let index = 0; index < meaning.length; index++) {
    const char = meaning[index]!;
    if (stack.at(-1) === char) { stack.pop(); continue; }
    if (stack.length && ['"', '”', '」', '』'].includes(stack.at(-1)!)) continue;
    if ([')', '）', ']', '】', '”', '」', '』'].includes(char)) return [meaning];
    if (pairs[char]) { stack.push(pairs[char]!); continue; }
    if (!stack.length && /[;；,，、\n]/u.test(char)) {
      if (char === ',' && /\d/u.test(meaning[index - 1] || '') && /\d/u.test(meaning[index + 1] || '')) continue;
      let end = index + 1;
      while (end < meaning.length && /\s/u.test(meaning[end]!)) end++;
      const segment = meaning.slice(start, end);
      if (segment.replace(/[;；,，、\s]/gu, '').length) { items.push(segment); start = end; }
      index = end - 1;
    }
  }
  if (stack.length) return [meaning];
  const tail = meaning.slice(start);
  if (tail.replace(/[;；,，、\s]/gu, '').length || !items.length) items.push(tail);
  else items[items.length - 1] += tail;
  return items;
}
