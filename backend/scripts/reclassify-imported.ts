// Re-checks the MCP servers that were imported from GitHub against the current parser rules, without calling GitHub:
//   - tools that are not tools (categories, parameters, script files, formats) are listed, and removed with --apply
//   - risk levels are recomputed; a level is only ever raised, never lowered
//   - servers left with no tool at all are listed for a human to take down (never removed here)
//   - the stored description and tool text is scanned for prompt injection and flagged ones are listed
// It never changes is_verified. Dry run unless --apply; --apply first writes a JSON backup of every row it touches.
// Usage: npm run reclassify:imported -- [--apply] [--backup-dir <dir>]
import '../src/loadEnv.js';
import fs from 'node:fs';
import path from 'node:path';
import { ToolRiskLevel } from '@prisma/client';
import { prisma } from '../src/config/prisma.js';
import { classifyRisk, isLikelyTool } from '../src/services/githubImport.service.js';
import { SecurityScanner } from '../src/services/scanner.service.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backupDir = args.includes('--backup-dir') ? args[args.indexOf('--backup-dir') + 1] : path.join(process.cwd(), 'reclassify-backup');
const RANK: Record<ToolRiskLevel, number> = { read_only: 0, network: 1, filesystem: 2, destructive: 3 };

const servers = await prisma.mcpServer.findMany({
  where: { source_url: { not: null }, is_deleted: false },
  select: { server_id: true, name: true, is_verified: true, description: true, tools: { select: { tool_id: true, name: true, description: true, risk_level: true } } },
  orderBy: { name: 'asc' },
});

const toRemove: Array<{ server: string; tool_id: string; name: string; description: string | null; risk_level: ToolRiskLevel }> = [];
const toRaise: Array<{ server: string; tool_id: string; name: string; from: ToolRiskLevel; to: ToolRiskLevel; description: string | null }> = [];
const emptied: string[] = [];
const flagged: Array<{ server: string; live: boolean; flags: string[] }> = [];
let lowered = 0;

for (const s of servers) {
  const keep = s.tools.filter((t) => isLikelyTool(t.name, t.description ?? ''));
  for (const t of s.tools) {
    if (!keep.includes(t)) { toRemove.push({ server: s.name, tool_id: t.tool_id, name: t.name, description: t.description, risk_level: t.risk_level }); continue; }
    const next = classifyRisk(t.name, t.description ?? '');
    if (RANK[next] > RANK[t.risk_level]) toRaise.push({ server: s.name, tool_id: t.tool_id, name: t.name, from: t.risk_level, to: next, description: t.description });
    else if (RANK[next] < RANK[t.risk_level]) lowered += 1; // reported, not applied
  }
  if (keep.length === 0) emptied.push(`${s.name}${s.is_verified ? ' (live)' : ''}`);
  const scan = SecurityScanner.scanSkillContent([s.description ?? '', ...keep.map((t) => `${t.name}: ${t.description ?? ''}`)].join('\n'));
  if (scan.prompt_injection_detected) flagged.push({ server: s.name, live: s.is_verified, flags: scan.flags });
}

const line = (s: string) => console.log(s);
line(`${apply ? 'APPLYING' : 'DRY RUN'}: ${servers.length} imported servers, ${servers.reduce((n, s) => n + s.tools.length, 0)} tools`);
line(`\n== tools that are not tools (${toRemove.length}) ==`);
for (const t of toRemove) line(`  ${t.server.padEnd(30)} ${t.name.padEnd(24)} ${t.risk_level.padEnd(11)} ${JSON.stringify((t.description ?? '').slice(0, 60))}`);
line(`\n== risk raised (${toRaise.length}); ${lowered} would be lower and are left alone ==`);
for (const t of toRaise) line(`  ${t.server.padEnd(30)} ${t.name.padEnd(24)} ${t.from} -> ${t.to}  ${JSON.stringify((t.description ?? '').slice(0, 50))}`);
line(`\n== servers left with no tool: decide whether to take them down (${emptied.length}) ==`);
for (const e of emptied) line(`  ${e}`);
line(`\n== scanner flags on stored text (${flagged.length}) ==`);
for (const f of flagged) line(`  ${f.server}${f.live ? ' (live)' : ''}: ${f.flags.join('; ')}`);

if (apply) {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, 'reclassify-backup.json');
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), removed: toRemove, raised: toRaise }, null, 1));
  await prisma.$transaction([
    ...toRaise.map((t) => prisma.toolDefinition.update({ where: { tool_id: t.tool_id }, data: { risk_level: t.to } })),
    prisma.toolDefinition.deleteMany({ where: { tool_id: { in: toRemove.map((t) => t.tool_id) } } }),
  ]);
  line(`\nbackup: ${file}\ndone: ${toRaise.length} raised, ${toRemove.length} removed`);
} else {
  line('\nNothing was changed. Run again with --apply to write (a JSON backup is saved first).');
}
await prisma.$disconnect();
