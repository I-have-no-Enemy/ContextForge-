// Runs the ContextForge LLM01 scanner over local SKILL.md folders.
// Usage: npx tsx scripts/scan-skills.ts <dir> [<dir>...]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SecurityScanner } from '../src/services/scanner.service.js';

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

const files = process.argv.slice(2).flatMap(walk);
let flagged = 0;
for (const f of files) {
  const r = SecurityScanner.scanSkillContent(readFileSync(f, 'utf8'));
  if (r.prompt_injection_detected) {
    flagged++;
    console.log(`FLAG ${f}: ${r.flags.join('; ')}`);
  }
}
console.log(`scanned ${files.length} files, ${flagged} flagged`);
process.exitCode = flagged ? 1 : 0;
