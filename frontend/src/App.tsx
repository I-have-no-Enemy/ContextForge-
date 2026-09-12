import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  Cpu,
  Terminal,
  Sparkles,
  CheckCircle2,
  Copy,
  Download,
  Search,
  ExternalLink,
  Lock,
  UserCheck,
  AlertTriangle,
  FileCode,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  fetchHealth,
  fetchServers,
  fetchSkills,
  generateConfigSnapshot,
  loginUser,
  fetchAdminSubmissions,
  reviewSubmission,
  McpServer,
  AiSkill,
  GeneratedConfig,
  UserProfile,
} from './services/api';

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'servers' | 'skills' | 'admin'>('servers');
  const [health, setHealth] = useState<{ status: string; uptimeSeconds: number } | null>(null);

  // Data Collections
  const [servers, setServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<AiSkill[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('all');

  // Selection Tray
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [targetClient, setTargetClient] = useState<'claude_desktop' | 'cursor' | 'cline' | 'antigravity'>('claude_desktop');

  // Generated Output Modal
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Preview Skill Modal
  const [inspectingSkill, setInspectingSkill] = useState<AiSkill | null>(null);

  // Auth State
  const [token, setToken] = useState<string | null>(localStorage.getItem('contextforge_token'));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('contextforge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Initial Load
  useEffect(() => {
    fetchHealth()
      .then((res) => res.success && setHealth(res.data))
      .catch(() => {});

    loadData();
  }, []);

  // 2. Load Servers & Skills
  const loadData = async () => {
    setLoading(true);
    try {
      const [serversData, skillsData] = await Promise.all([
        fetchServers(searchQuery),
        fetchSkills(searchQuery, clientFilter),
      ]);
      setServers(serversData);
      setSkills(skillsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, clientFilter]);

  // Load Admin Submissions when entering Admin Tab
  useEffect(() => {
    if (activeTab === 'admin' && token && currentUser?.role === 'admin') {
      fetchAdminSubmissions(token)
        .then(setSubmissions)
        .catch((err) => console.error('Failed to fetch admin submissions:', err));
    }
  }, [activeTab, token, currentUser]);

  // Selection Handlers
  const toggleServer = (id: string) => {
    setSelectedServerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedServerIds([]);
    setSelectedSkillIds([]);
  };

  // Quick Demo Login
  const handleDemoLogin = async (role: 'admin' | 'dev') => {
    setAuthError(null);
    try {
      const email = role === 'admin' ? 'admin@contextforge.local' : 'developer@contextforge.local';
      const password = 'Password123!';
      const res = await loginUser(email, password);
      setToken(res.token);
      setCurrentUser(res.user);
      localStorage.setItem('contextforge_token', res.token);
      localStorage.setItem('contextforge_user', JSON.stringify(res.user));
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('contextforge_token');
    localStorage.removeItem('contextforge_user');
    if (activeTab === 'admin') setActiveTab('servers');
  };

  // Generate Config
  const handleGenerate = async () => {
    if (selectedServerIds.length === 0 && selectedSkillIds.length === 0) return;
    setIsGenerating(true);
    try {
      const config = await generateConfigSnapshot(
        targetClient,
        selectedServerIds,
        selectedSkillIds,
        token || undefined
      );
      setGeneratedConfig(config);
    } catch (err: any) {
      alert(err.message || 'Failed to generate config');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy to Clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Config File
  const handleDownload = () => {
    if (!generatedConfig) return;
    const blob = new Blob([JSON.stringify(generatedConfig.generated_json, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedConfig.client_type}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Admin Review Action
  const handleReview = async (itemType: 'server' | 'skill', itemId: string, status: 'approved' | 'rejected') => {
    if (!token) return;
    try {
      await reviewSubmission(token, {
        item_type: itemType,
        item_id: itemId,
        status,
        review_notes: `Reviewed by ${currentUser?.email} from ContextForge Dashboard`,
      });
      // Refresh submissions
      const updated = await fetchAdminSubmissions(token);
      setSubmissions(updated);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    }
  };

  const totalSelected = selectedServerIds.length + selectedSkillIds.length;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e6e6e6] font-sans antialiased flex flex-col justify-between selection:bg-neutral-800">
      {/* 1. Header */}
      <header className="border-b border-[#212121] bg-[#121212]/90 sticky top-0 z-40 backdrop-blur px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white text-[#101010] flex items-center justify-center font-bold font-mono text-sm shadow-sm">
            CF
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              ContextForge
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#222] text-[#aaa] border border-[#333]">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-[#888] font-mono">Unified MCP & AI Skills Registry</p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-[#262626]">
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === 'servers'
                ? 'bg-[#2b2b2b] text-white shadow-sm'
                : 'text-[#999] hover:text-[#eee]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              MCP Servers ({servers.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === 'skills'
                ? 'bg-[#2b2b2b] text-white shadow-sm'
                : 'text-[#999] hover:text-[#eee]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              AI Skills ({skills.length})
            </div>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                  : 'text-[#999] hover:text-[#eee]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                Admin Queue ({submissions.filter((s) => s.status === 'pending').length})
              </div>
            </button>
          )}
        </nav>

        {/* Right Auth / Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono px-2.5 py-1 rounded-full border border-[#262626] bg-[#161616]">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[#aaa]">
              {health?.status === 'healthy' ? 'API Online (06016418)' : 'Connecting...'}
            </span>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs bg-[#1f1f1f] border border-[#2f2f2f] px-2.5 py-1 rounded">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-white font-mono">{currentUser.email.split('@')[0]}</span>
                <span className="text-[10px] text-amber-300 font-mono uppercase bg-[#2a2a2a] px-1 rounded">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-[#888] hover:text-white px-2 py-1 rounded hover:bg-[#222]"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDemoLogin('dev')}
                className="text-xs px-2.5 py-1 rounded bg-[#202020] hover:bg-[#2c2c2c] border border-[#333] text-[#ddd] transition-colors"
              >
                Dev Login
              </button>
              <button
                onClick={() => handleDemoLogin('admin')}
                className="text-xs px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-200 transition-colors"
              >
                Admin Demo
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Body */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full pb-28">
        {/* Banner */}
        <div className="mb-8 border border-[#262626] rounded-xl p-6 bg-gradient-to-b from-[#161616] to-[#101010]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-[#333] bg-[#1a1a1a] text-[11px] text-[#bbb] mb-3">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Unified Governance Registry & 1-Click Multi-Client Exporter</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-2">
                ContextForge Platform
              </h2>
              <p className="text-xs md:text-sm text-[#8f8f8f] max-w-2xl leading-relaxed">
                Empowering production AI agents (Claude Desktop, Cursor, Cline, Antigravity) with vetted Model Context Protocol tools and indirect prompt injection defense (OWASP LLM01).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center p-3 rounded-lg bg-[#181818] border border-[#262626] min-w-[100px]">
                <div className="text-xl font-mono font-bold text-white">{servers.length}</div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider">MCP Servers</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-[#181818] border border-[#262626] min-w-[100px]">
                <div className="text-xl font-mono font-bold text-white">{skills.length}</div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider">AI Skills</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-[#181818] border border-[#262626] min-w-[100px]">
                <div className="text-xl font-mono font-bold text-emerald-400">100%</div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider">Scanned Safe</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#777] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'servers' ? 'servers & tools...' : 'skills & playbooks...'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161616] border border-[#2b2b2b] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#666] focus:outline-none focus:border-[#555] transition-all"
            />
          </div>

          {activeTab === 'skills' && (
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['all', 'claude_desktop', 'cursor', 'cline', 'antigravity'].map((client) => (
                <button
                  key={client}
                  onClick={() => setClientFilter(client)}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
                    clientFilter === client
                      ? 'bg-white text-[#111] border-white font-medium'
                      : 'bg-[#181818] text-[#999] border-[#292929] hover:text-white'
                  }`}
                >
                  {client === 'all' ? 'All Clients' : client}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Tab Content: MCP Servers */}
        {activeTab === 'servers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.map((server) => {
              const isSelected = selectedServerIds.includes(server.id);
              return (
                <div
                  key={server.id}
                  className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-white bg-[#1a1a1a] shadow-md'
                      : 'border-[#242424] bg-[#141414] hover:border-[#363636]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          {server.name}
                          {server.is_verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </h3>
                        <p className="text-xs text-[#8e8e8e] mt-1 leading-relaxed">
                          {server.description || 'No description provided.'}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleServer(server.id)}
                        className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${
                          isSelected
                            ? 'bg-white text-black'
                            : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2b2b2b]'
                        }`}
                      >
                        {isSelected ? 'Selected' : '+ Select'}
                      </button>
                    </div>

                    {/* Install Command */}
                    <div className="my-3 bg-[#0d0d0d] p-2 rounded border border-[#222] flex items-center justify-between gap-2 font-mono text-[11px] text-[#bbb]">
                      <span className="truncate">{server.install_command}</span>
                      <button
                        onClick={() => handleCopy(server.install_command)}
                        className="text-[#777] hover:text-white shrink-0 p-1"
                        title="Copy command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#202020] text-[11px] text-[#777] font-mono">
                    <div className="flex items-center gap-3">
                      <span>★ {server.github_stars}</span>
                      <span>⬇ {server.downloads_count} runs</span>
                    </div>
                    {server.repository_url && (
                      <a
                        href={server.repository_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-[#ccc] flex items-center gap-1"
                      >
                        GitHub <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Tab Content: AI Skills */}
        {activeTab === 'skills' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map((skill) => {
              const isSelected = selectedSkillIds.includes(skill.id);
              const isFlagged = skill.scan_flags?.prompt_injection_detected;

              return (
                <div
                  key={skill.id}
                  className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-white bg-[#1a1a1a] shadow-md'
                      : 'border-[#242424] bg-[#141414] hover:border-[#363636]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          {skill.name}
                          {isFlagged ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Flagged
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Scanned Clean
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#8e8e8e] mt-1 leading-relaxed">
                          {skill.description || 'AI playbook and guideline.'}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${
                          isSelected
                            ? 'bg-white text-black'
                            : 'bg-[#222] text-[#aaa] hover:text-white hover:bg-[#2b2b2b]'
                        }`}
                      >
                        {isSelected ? 'Selected' : '+ Select'}
                      </button>
                    </div>

                    {/* Compatible Clients & Tags */}
                    <div className="my-3 flex flex-wrap gap-1">
                      {skill.compatible_clients.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c1c1c] text-[#aaa] border border-[#2b2b2b]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#202020] text-[11px] text-[#777]">
                    <button
                      onClick={() => setInspectingSkill(skill)}
                      className="text-xs text-[#aaa] hover:text-white flex items-center gap-1 underline underline-offset-2"
                    >
                      <FileCode className="w-3 h-3" /> Inspect SKILL.md
                    </button>
                    <span className="font-mono">⬇ {skill.downloads_count} exports</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 6. Tab Content: Admin Queue */}
        {activeTab === 'admin' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-950/20 border border-red-900/40 text-xs text-red-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <span>
                Administrative Governance Queue — Reviews items flagged by in-process LLM01 heuristics.
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-12 text-sm text-[#777]">
                No pending submissions in queue. All systems green!
              </div>
            ) : (
              submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-5 rounded-xl border border-[#2b2b2b] bg-[#141414] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#222] text-white">
                        {sub.item_type}
                      </span>
                      <span className="text-xs font-mono text-[#aaa]">{sub.item_id}</span>
                      {sub.flagged_by_scan && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 font-mono">
                          <AlertTriangle className="w-3 h-3" /> Scanner Alert
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#999]">{sub.review_notes || 'Pending moderator review'}</p>
                  </div>

                  {sub.status === 'pending' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReview(sub.item_type, sub.item_id, 'approved')}
                        className="text-xs px-3 py-1.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 font-medium"
                      >
                        Approve & Verify
                      </button>
                      <button
                        onClick={() => handleReview(sub.item_type, sub.item_id, 'rejected')}
                        className="text-xs px-3 py-1.5 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 font-medium"
                      >
                        Reject Submission
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono px-2 py-1 rounded bg-[#222] text-[#888] uppercase">
                      Status: {sub.status}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* 7. Floating 1-Click Config Generator Tray */}
      {totalSelected > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-3xl bg-[#171717] border border-[#333] shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-mono font-bold text-sm">
              {totalSelected}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">
                {selectedServerIds.length} Servers, {selectedSkillIds.length} Skills Selected
              </div>
              <div className="text-[11px] text-[#888] font-mono">Ready to compile unified config</div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              value={targetClient}
              onChange={(e: any) => setTargetClient(e.target.value)}
              className="bg-[#222] border border-[#3a3a3a] text-xs text-white px-3 py-2 rounded-lg font-mono focus:outline-none"
            >
              <option value="claude_desktop">Claude Desktop (claude_desktop_config.json)</option>
              <option value="cursor">Cursor (.cursor/mcp.json)</option>
              <option value="cline">Cline (cline_mcp_settings.json)</option>
              <option value="antigravity">Antigravity (agy.mcp.json)</option>
            </select>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 rounded-lg bg-white hover:bg-[#eaeaea] text-black text-xs font-semibold flex items-center gap-2 transition-all shrink-0"
            >
              {isGenerating ? 'Generating...' : '1-Click Export'} <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={clearSelection}
              className="text-[#888] hover:text-white p-2 rounded-lg text-xs hover:bg-[#222]"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 8. Modal: Generated Config Output */}
      {generatedConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2b2b2b] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#222] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  Generated Client Configuration
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#252525] text-amber-300">
                    {generatedConfig.client_type}
                  </span>
                </h3>
                <p className="text-[11px] text-[#888] font-mono">Snapshot ID: {generatedConfig.id}</p>
              </div>

              <button
                onClick={() => setGeneratedConfig(null)}
                className="text-[#777] hover:text-white p-1 rounded hover:bg-[#222]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <pre className="bg-[#0b0b0b] p-4 rounded-xl border border-[#222] text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                {JSON.stringify(generatedConfig.generated_json, null, 2)}
              </pre>
            </div>

            <div className="px-6 py-4 border-t border-[#222] flex items-center justify-between bg-[#111]">
              <span className="text-xs text-[#777] font-mono">
                Downloads incremented on registry
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(JSON.stringify(generatedConfig.generated_json, null, 2))}
                  className="px-3 py-1.5 rounded-lg border border-[#333] hover:bg-[#222] text-xs text-white flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>

                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#eee] text-black text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: SKILL.md Inspector */}
      {inspectingSkill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2b2b2b] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#222] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  {inspectingSkill.name}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#252525] text-[#aaa]">
                    SKILL.md
                  </span>
                </h3>
                <p className="text-[11px] text-[#888] font-mono">{inspectingSkill.description}</p>
              </div>

              <button
                onClick={() => setInspectingSkill(null)}
                className="text-[#777] hover:text-white p-1 rounded hover:bg-[#222]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <pre className="bg-[#0b0b0b] p-4 rounded-xl border border-[#222] text-xs font-mono text-[#dcdcdc] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {inspectingSkill.skill_content}
              </pre>
            </div>

            <div className="px-6 py-3 border-t border-[#222] flex items-center justify-end bg-[#111]">
              <button
                onClick={() => setInspectingSkill(null)}
                className="px-3 py-1.5 rounded-lg bg-[#222] hover:bg-[#2b2b2b] text-xs text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Footer */}
      <footer className="border-t border-[#212121] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#666] font-mono bg-[#0d0d0d]">
        <div>
          ContextForge Platform — Course 06016418 Server-Side Web Development (KMITL IT)
        </div>
        <div className="flex items-center gap-4">
          <span>OWASP Top 10 + LLM01 Hardened</span>
          <a
            href="https://github.com/I-have-no-Enemy/ContextForge-"
            target="_blank"
            rel="noreferrer"
            className="text-[#888] hover:text-white underline underline-offset-2"
          >
            Source Code
          </a>
        </div>
      </footer>
    </div>
  );
}
