export interface ScanResult {
  isSafe: boolean;
  prompt_injection_detected: boolean;
  flags: string[];
  riskScore: number; // 0 to 100
}

interface HeuristicPattern {
  id: string;
  name: string;
  regex: RegExp;
  weight: number;
}

const HEURISTIC_PATTERNS: HeuristicPattern[] = [
  {
    id: 'SYS_OVERRIDE',
    name: 'System Prompt Override / Jailbreak',
    regex: /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|prompts|directions)|you\s+are\s+now\s+in\s+developer\s+mode|dan\s+mode/i,
    weight: 40,
  },
  {
    id: 'DATA_EXFIL',
    name: 'Data Exfiltration Webhook / Hidden Ping',
    regex: /(?:https?:\/\/[^\s"'`]+\.(?:webhook|ngrok|pipedream|requestbin|burpcollaborator)[^\s"'`]*)|!\[.*?\]\(https?:\/\/[^\s"'`]+\?[^\s"'`]*token=/i,
    weight: 50,
  },
  {
    id: 'SECRET_HARVEST',
    name: 'Secret / Credential Harvesting',
    regex: /(?:print|dump|read|send|exfiltrate)\s+(?:all\s+)?(?:env|environment|api_keys?|passwords?|tokens?|secrets?)/i,
    weight: 35,
  },
  {
    id: 'SHELL_EXEC',
    name: 'Arbitrary Shell Execution Payload',
    regex: /(?:eval\s*\(|child_process|execSync\s*\(|spawnSync\s*\(|subprocess\.Popen|\/bin\/(?:sh|bash))/i,
    weight: 45,
  },
  {
    id: 'SECRET_HIDING',
    name: 'Instruction Obfuscation (Hide from user)',
    regex: /(?:do\s+not\s+(?:tell|show|inform|reveal\s+to)\s+the\s+user|silently\s+(?:run|send|execute)|without\s+(?:the\s+)?user(?:'s)?\s+knowledge)/i,
    weight: 30,
  },
];

export class SecurityScanner {
  /**
   * Fast in-process heuristic scanner for AI Skill markdown content
   * Execution time < 5ms, zero external network dependency.
   */
  public static scanSkillContent(content: string): ScanResult {
    const flags: string[] = [];
    let totalWeight = 0;

    for (const pattern of HEURISTIC_PATTERNS) {
      if (pattern.regex.test(content)) {
        flags.push(`${pattern.id}: ${pattern.name}`);
        totalWeight += pattern.weight;
      }
    }

    const prompt_injection_detected = flags.length > 0;
    const isSafe = totalWeight < 30;

    return {
      isSafe,
      prompt_injection_detected,
      flags,
      riskScore: Math.min(100, totalWeight),
    };
  }
}
