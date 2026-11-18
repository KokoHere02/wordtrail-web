/** Preserve the original text, including punctuation, when emphasizing a word or phrase. */
export function splitExample(text: string, terms: readonly string[]) {
  const alternatives = terms.map(term => term.trim()).filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!alternatives.length) return [{ text, match: false }];

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?<!\\p{L}['’])(${alternatives.join('|')})(?![\\p{L}\\p{N}_]|['’]\\p{L})`, 'giu',
  );
  return text.split(pattern)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter(part => part.text.length > 0);
}
