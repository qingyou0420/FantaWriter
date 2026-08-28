/** 从本章正文抽出某人物的台词，供声音遍对照。本地处理，不调 AI。 */
export function extractCharacterDialogue(
  content: string,
  name: string,
  limit = 8
): string[] {
  const who = name.trim();
  if (!who || !content.trim()) return [];
  const chunks: string[] = [];
  const quote =
    /[「“"]([^」”"]{2,80})[」”"]/g;
  const lines = content.split(/\n/);
  for (const line of lines) {
    if (!line.includes(who)) continue;
    quote.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = quote.exec(line))) {
      chunks.push(m[1].trim());
      if (chunks.length >= limit) return chunks;
    }
  }
  if (chunks.length) return chunks;
  quote.lastIndex = 0;
  let m: RegExpExecArray | null;
  const nearby = content.split(/[。！？\n]/).filter((s) => s.includes(who));
  for (const sentence of nearby) {
    quote.lastIndex = 0;
    while ((m = quote.exec(sentence))) {
      chunks.push(m[1].trim());
      if (chunks.length >= limit) return chunks;
    }
  }
  return chunks;
}
