import React, { useEffect, useState } from 'react';
import { ShieldCheck, Cpu, Terminal, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface SystemHealth {
  status: string;
  uptimeSeconds: number;
  version: string;
}

export default function App() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHealth(data.data);
        }
      })
      .catch((err) => console.log('API not reachable yet:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#101010] text-[#f3f3f3] flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="border-b border-[#212121] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white text-[#101010] flex items-center justify-center font-bold font-mono text-sm">
            CF
          </div>
          <div>
            <h1 className="text-base font-medium tracking-tight">ContextForge</h1>
            <p className="text-xs text-[#9c9c9c] font-mono">Unified MCP & Skills Registry</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full border border-[#212121] bg-[#080808]">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {loading ? 'Checking API...' : health?.status === 'healthy' ? 'API Online' : 'API Connecting'}
          </div>
          <a
            href="https://github.com/I-have-no-Enemy/ContextForge-"
            target="_blank"
            rel="noreferrer"
            className="btn-pill text-xs flex items-center gap-1.5"
          >
            GitHub Repo <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#212121] bg-[#080808] text-xs text-[#c1c1c1] mb-6 w-fit">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Hyperstudio Architecture — OWASP-Grounded Governance</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-white mb-4 leading-tight">
          Unified MCP Tools & AI Skills <br />
          <span className="text-[#9c9c9c]">Hardened for Production Agents.</span>
        </h2>

        <p className="text-[#9c9c9c] max-w-2xl text-base mb-8 leading-relaxed">
          One single platform to catalog Model Context Protocol servers and specialized agent playbooks.
          Equipped with automated prompt injection detection, human-in-the-loop review, and 1-click client exports.
        </p>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="p-6 rounded-lg border border-[#212121] bg-[#080808]">
            <Terminal className="w-5 h-5 text-white mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">MCP Tool Catalog</h3>
            <p className="text-xs text-[#9c9c9c] leading-relaxed">
              Transparent JSON schemas, parameter requirements, and permission risk badges.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-[#212121] bg-[#080808]">
            <Cpu className="w-5 h-5 text-white mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">AI Skills Engine</h3>
            <p className="text-xs text-[#9c9c9c] leading-relaxed">
              Curated SKILL.md playbooks for Claude Desktop, Cursor, Cline, and Antigravity.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-[#212121] bg-[#080808]">
            <ShieldCheck className="w-5 h-5 text-white mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">LLM01 Defense</h3>
            <p className="text-xs text-[#9c9c9c] leading-relaxed">
              Automated in-process heuristic scanner detecting indirect prompt injections & exfiltration.
            </p>
          </div>
        </div>

        {/* Action Callout */}
        <div className="p-6 rounded-lg border border-[#212121] bg-[#141414] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Monorepo Scaffolding Active</p>
              <p className="text-xs text-[#9c9c9c]">
                PostgreSQL 16 Schema ready • Express 5 TypeScript API • Vitest Suite Configured
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <code className="text-xs font-mono bg-[#080808] px-3 py-1.5 rounded border border-[#212121] text-[#f3f3f3]">
              npm run dev
            </code>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#212121] px-6 py-4 text-center text-xs text-[#9c9c9c] font-mono">
        ContextForge • 06016418 Server-Side Web Development • KMITL IT 2026
      </footer>
    </div>
  );
}
