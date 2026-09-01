import type { MemoryDB } from "../state/memory-db.js";
import type { Character } from "./graph-schema.js";

export function writeCharacterFacts(db: MemoryDB, chars: readonly Character[], rev: number): void {
  for (const c of chars) {
    if (c.motivation) {
      db.addFact({ subject: c.name, predicate: "motivation", object: c.motivation, validFromChapter: rev, validUntilChapter: null, sourceChapter: rev });
    }
    const vp = c.voiceProfile;
    if (vp?.speakingRhythm || vp?.vocabulary) {
      db.addFact({ subject: c.name, predicate: "voice", object: [vp?.speakingRhythm, vp?.vocabulary].filter(Boolean).join(" / "), validFromChapter: rev, validUntilChapter: null, sourceChapter: rev });
    }
  }
}

export function readCharacterVoices(
  db: MemoryDB,
  names: readonly string[],
): ReadonlyArray<{ subject: string; predicate: string; object: string }> {
  return db.getFactsForCharacters(names).map((f) => ({ subject: f.subject, predicate: f.predicate, object: f.object }));
}
