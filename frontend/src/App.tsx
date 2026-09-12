import React, { useEffect, useState } from 'react';
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
  UserCheck,
  AlertTriangle,
  FileCode,
  ArrowRight,
  X,
  RefreshCw,
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
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    setFetchError(null);
    try {
      const [serversData, skillsData] = await Promise.all([
        fetchServers(searchQuery),
        fetchSkills(searchQuery, clientFilter),
      ]);
      setServers(serversData);
      setSkills(skillsData);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setFetchError(err.message || 'Database not ready or API unreachable.');
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

  // Quick Demo Login with exact seeded credentials
  const handleDemoLogin = async (role: 'admin' | 'dev') => {
    setAuthError(null);
    try {
      const email = role === 'admin' ? 'admin@contextforge.dev' : 'developer@contextforge.dev';
      const password = role === 'admin' ? 'AdminPassword123!' : 'DevPassword123!';
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
      const updated = await fetchAdminSubmissions(token);
      setSubmissions(updated);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    }
  };

  const totalSelected = selectedServerIds.length + selectedSkillIds.length;

  return (
    <div className="min-h-screen bg-[#101010] text-[#f3f3f3] font-sans antialiased flex flex-col justify-between selection:bg-[#212121] selection:text-white">
      {/* 1. Header (Hyperstudio Canvas Header) */}
      <header className="border-b border-[#212121] bg-[#080808]/90 sticky top-0 z-40 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#ffffff] text-[#101010] flex items-center justify-center font-bold font-mono text-xs shadow-sm">
            CF
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#f3f3f3] flex items-center gap-2">
              ContextForge
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#101010] text-[#9c9c9c] border border-[#212121]">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-[#9c9c9c] font-mono">Unified MCP Tools & AI Skills Registry</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#101010] p-1 rounded-lg border border-[#212121]">
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === 'servers'
                ? 'bg-[#212121] text-[#f3f3f3] shadow-sm'
                : 'text-[#9c9c9c] hover:text-[#f3f3f3]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#f3f3f3]" />
              MCP Servers ({servers.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === 'skills'
                ? 'bg-[#212121] text-[#f3f3f3] shadow-sm'
                : 'text-[#9c9c9c] hover:text-[#f3f3f3]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#f3f3f3]" />
              AI Skills ({skills.length})
            </div>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-[#212121] text-amber-300 border border-amber-800/40'
                  : 'text-[#9c9c9c] hover:text-[#f3f3f3]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Admin Queue ({submissions.filter((s) => s.status === 'pending').length})
              </div>
            </button>
          )}
        </nav>

        {/* Right Auth / Telemetry */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono px-3 py-1 rounded-full border border-[#212121] bg-[#080808]">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[#9c9c9c]">
              {health?.status === 'healthy' ? 'API 06016418 Ready' : 'Connecting...'}
            </span>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs bg-[#080808] border border-[#212121] px-3 py-1 rounded-full">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[#f3f3f3] font-mono">{currentUser.email.split('@')[0]}</span>
                <span className="text-[10px] text-amber-300 font-mono uppercase bg-[#1a1a1a] px-1 rounded">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-[#9c9c9c] hover:text-[#f3f3f3] px-2 py-1 rounded hover:bg-[#212121] transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDemoLogin('dev')}
                className="text-xs px-3 py-1 rounded-full bg-[#080808] hover:bg-[#212121] border border-[#212121] text-[#f3f3f3] transition-colors font-mono"
              >
                Dev Login
              </button>
              <button
                onClick={() => handleDemoLogin('admin')}
                className="btn-pill text-xs !py-1 !px-3 font-mono"
              >
                Admin Login
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Body */}
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full pb-32">
        {/* Banner Section with Hyperstudio Tokens */}
        <div className="mb-8 border border-[#212121] rounded-2xl p-6 md:p-8 bg-[#080808] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#212121] bg-[#101010] text-[11px] text-[#c1c1c1] mb-4">
                <Sparkles className="w-3.5 h-3.5 text-[#6f6759]" />
                <span>Hyperstudio Architecture — OWASP-Grounded Governance</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-normal tracking-tight text-[#f3f3f3] mb-3 leading-tight">
                Hardened MCP Tools & AI Skills <br />
                <span className="text-[#9c9c9c]">for Autonomous Agent Workflows.</span>
              </h2>
              <p className="text-xs md:text-sm text-[#9c9c9c] max-w-2xl leading-relaxed">
                Centralized registry with heuristic prompt injection scanning (OWASP LLM01), multi-client config translation, and human-in-the-loop review queues.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="text-center p-4 rounded-xl bg-[#101010] border border-[#212121] min-w-[90px]">
                <div className="text-2xl font-mono font-bold text-[#f3f3f3]">{servers.length}</div>
                <div className="text-[10px] text-[#9c9c9c] uppercase tracking-wider font-mono">Servers</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#101010] border border-[#212121] min-w-[90px]">
                <div className="text-2xl font-mono font-bold text-[#f3f3f3]">{skills.length}</div>
                <div className="text-[10px] text-[#9c9c9c] uppercase tracking-wider font-mono">Skills</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#101010] border border-[#212121] min-w-[90px]">
                <div className="text-2xl font-mono font-bold text-emerald-400">100%</div>
                <div className="text-[10px] text-[#9c9c9c] uppercase tracking-wider font-mono">Audited</div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert if DB was not ready */}
        {fetchError && (
          <div className="mb-6 p-4 rounded-xl bg-[#101010] border border-red-900/50 flex items-center justify-between gap-4 text-xs text-red-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded bg-red-950 border border-red-800 text-red-200 font-mono flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Retry Connection
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#9c9c9c] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'servers' ? 'MCP servers & tools...' : 'AI skills & playbooks...'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#080808] border border-[#212121] rounded-lg pl-10 pr-3 py-2 text-xs text-[#f3f3f3] placeholder-[#9c9c9c] focus:outline-none focus:border-[#474747] transition-all font-mono"
            />
          </div>

          {activeTab === 'skills' && (
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['all', 'claude_desktop', 'cursor', 'cline', 'antigravity'].map((client) => (
                <button
                  key={client}
                  onClick={() => setClientFilter(client)}
                  className={`text-[11px] font-mono px-3 py-1.5 rounded border transition-colors whitespace-nowrap ${
                    clientFilter === client
                      ? 'bg-[#ffffff] text-[#101010] border-[#ffffff] font-medium'
                      : 'bg-[#080808] text-[#9c9c9c] border-[#212121] hover:text-[#f3f3f3]'
                  }`}
                >
                  {client === 'all' ? 'All Clients' : client}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: MCP Servers Catalog */}
        {activeTab === 'servers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.map((server) => {
              const isSelected = selectedServerIds.includes(server.id);
              return (
                <div
                  key={server.id}
                  className={`p-6 rounded-xl border transition-all flex flex-col justify-between bg-[#080808] ${
                    isSelected
                      ? 'border-[#ffffff] shadow-lg ring-1 ring-white/10'
                      : 'border-[#212121] hover:border-[#3b3d45]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#f3f3f3] flex items-center gap-2">
                          {server.name}
                          {server.is_verified && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                        </h3>
                        <p className="text-xs text-[#9c9c9c] mt-1.5 leading-relaxed">
                          {server.description || 'No description provided.'}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleServer(server.id)}
                        className={`text-xs px-3 py-1 rounded font-mono font-medium transition-all ${
                          isSelected
                            ? 'bg-[#ffffff] text-[#101010]'
                            : 'bg-[#1a1a1a] text-[#c1c1c1] hover:text-white hover:bg-[#212121] border border-[#212121]'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : '+ Select'}
                      </button>
                    </div>

                    {/* Install Command */}
                    <div className="my-4 bg-[#101010] p-2.5 rounded border border-[#212121] flex items-center justify-between gap-2 font-mono text-[11px] text-[#c1c1c1]">
                      <span className="truncate">{server.install_command}</span>
                      <button
                        onClick={() => handleCopy(server.install_command)}
                        className="text-[#9c9c9c] hover:text-white shrink-0 p-1"
                        title="Copy command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#212121] text-[11px] text-[#9c9c9c] font-mono">
                    <div className="flex items-center gap-4">
                      <span>★ {server.github_stars}</span>
                      <span>⬇ {server.downloads_count} runs</span>
                    </div>
                    {server.repository_url && (
                      <a
                        href={server.repository_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-white flex items-center gap-1 text-[#9c9c9c]"
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

        {/* Tab 2: AI Skills Catalog */}
        {activeTab === 'skills' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map((skill) => {
              const isSelected = selectedSkillIds.includes(skill.id);
              const isFlagged = skill.scan_flags?.prompt_injection_detected;

              return (
                <div
                  key={skill.id}
                  className={`p-6 rounded-xl border transition-all flex flex-col justify-between bg-[#080808] ${
                    isSelected
                      ? 'border-[#ffffff] shadow-lg ring-1 ring-white/10'
                      : 'border-[#212121] hover:border-[#3b3d45]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#f3f3f3] flex items-center gap-2">
                          {skill.name}
                          {isFlagged ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1 font-mono">
                              <AlertTriangle className="w-3 h-3" /> LLM01 Flagged
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1 font-mono">
                              <ShieldCheck className="w-3 h-3" /> Clean Heuristic
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#9c9c9c] mt-1.5 leading-relaxed">
                          {skill.description || 'AI playbook and workflow specification.'}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className={`text-xs px-3 py-1 rounded font-mono font-medium transition-all ${
                          isSelected
                            ? 'bg-[#ffffff] text-[#101010]'
                            : 'bg-[#1a1a1a] text-[#c1c1c1] hover:text-white hover:bg-[#212121] border border-[#212121]'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : '+ Select'}
                      </button>
                    </div>

                    {/* Compatible Clients & Tags */}
                    <div className="my-4 flex flex-wrap gap-1.5">
                      {skill.compatible_clients.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101010] text-[#9c9c9c] border border-[#212121]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#212121] text-[11px] text-[#9c9c9c]">
                    <button
                      onClick={() => setInspectingSkill(skill)}
                      className="text-xs text-[#c1c1c1] hover:text-white flex items-center gap-1 font-mono underline underline-offset-2"
                    >
                      <FileCode className="w-3.5 h-3.5" /> Inspect SKILL.md
                    </button>
                    <span className="font-mono">⬇ {skill.downloads_count} exports</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Admin Queue */}
        {activeTab === 'admin' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#080808] border border-amber-900/40 text-xs text-amber-200 flex items-center gap-2 font-mono">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>
                Administrative Governance Queue — Reviews items flagged by in-process LLM01 heuristics.
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-16 text-xs font-mono text-[#9c9c9c] bg-[#080808] rounded-xl border border-[#212121]">
                No pending submissions in queue. All systems green!
              </div>
            ) : (
              submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-5 rounded-xl border border-[#212121] bg-[#080808] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1a1a1a] text-white border border-[#212121]">
                        {sub.item_type}
                      </span>
                      <span className="text-xs font-mono text-[#9c9c9c]">{sub.item_id}</span>
                      {sub.flagged_by_scan && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 font-mono">
                          <AlertTriangle className="w-3 h-3" /> LLM01 Flagged
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9c9c9c]">{sub.review_notes || 'Pending moderator review'}</p>
                  </div>

                  {sub.status === 'pending' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReview(sub.item_type, sub.item_id, 'approved')}
                        className="text-xs px-3 py-1.5 rounded-full bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 font-mono"
                      >
                        Approve & Verify
                      </button>
                      <button
                        onClick={() => handleReview(sub.item_type, sub.item_id, 'rejected')}
                        className="text-xs px-3 py-1.5 rounded-full bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 font-mono"
                      >
                        Reject Submission
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#101010] text-[#9c9c9c] border border-[#212121] uppercase">
                      Status: {sub.status}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* 3. Floating Sticky Action Tray: 1-Click Multi-Client Config Generator */}
      {totalSelected > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-3xl bg-[#080808] border border-[#212121] shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ffffff] text-[#101010] flex items-center justify-center font-mono font-bold text-sm">
              {totalSelected}
            </div>
            <div>
              <div className="text-xs font-semibold text-[#f3f3f3]">
                {selectedServerIds.length} Servers, {selectedSkillIds.length} Skills Selected
              </div>
              <div className="text-[11px] text-[#9c9c9c] font-mono">Ready to compile snapshot</div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              value={targetClient}
              onChange={(e: any) => setTargetClient(e.target.value)}
              className="bg-[#101010] border border-[#212121] text-xs text-[#f3f3f3] px-3 py-2 rounded-lg font-mono focus:outline-none"
            >
              <option value="claude_desktop">Claude Desktop (claude_desktop_config.json)</option>
              <option value="cursor">Cursor (.cursor/mcp.json)</option>
              <option value="cline">Cline (cline_mcp_settings.json)</option>
              <option value="antigravity">Antigravity (agy.mcp.json)</option>
            </select>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="btn-pill text-xs !py-2 !px-4 flex items-center gap-1.5 shrink-0"
            >
              {isGenerating ? 'Generating...' : '1-Click Export'} <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={clearSelection}
              className="text-[#9c9c9c] hover:text-white p-2 rounded-lg text-xs hover:bg-[#212121]"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Modal: Generated Config Output */}
      {generatedConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#080808] border border-[#212121] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#212121] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#f3f3f3] flex items-center gap-2">
                  Generated Client Configuration
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#101010] text-[#f3f3f3] border border-[#212121]">
                    {generatedConfig.client_type}
                  </span>
                </h3>
                <p className="text-[11px] text-[#9c9c9c] font-mono">Snapshot ID: {generatedConfig.id}</p>
              </div>

              <button
                onClick={() => setGeneratedConfig(null)}
                className="text-[#9c9c9c] hover:text-white p-1 rounded hover:bg-[#212121]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <pre className="bg-[#101010] p-4 rounded-xl border border-[#212121] text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                {JSON.stringify(generatedConfig.generated_json, null, 2)}
              </pre>
            </div>

            <div className="px-6 py-4 border-t border-[#212121] flex items-center justify-between bg-[#080808]">
              <span className="text-xs text-[#9c9c9c] font-mono">
                Downloads incremented on registry
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(JSON.stringify(generatedConfig.generated_json, null, 2))}
                  className="px-3 py-1.5 rounded-full border border-[#212121] hover:bg-[#212121] text-xs text-[#f3f3f3] flex items-center gap-1.5 transition-colors font-mono"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>

                <button
                  onClick={handleDownload}
                  className="btn-pill text-xs !py-1.5 !px-4 flex items-center gap-1.5 font-mono"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: SKILL.md Inspector */}
      {inspectingSkill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#080808] border border-[#212121] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#212121] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#f3f3f3] flex items-center gap-2">
                  {inspectingSkill.name}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101010] text-[#9c9c9c] border border-[#212121]">
                    SKILL.md
                  </span>
                </h3>
                <p className="text-[11px] text-[#9c9c9c] font-mono">{inspectingSkill.description}</p>
              </div>

              <button
                onClick={() => setInspectingSkill(null)}
                className="text-[#9c9c9c] hover:text-white p-1 rounded hover:bg-[#212121]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <pre className="bg-[#101010] p-4 rounded-xl border border-[#212121] text-xs font-mono text-[#f3f3f3] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {inspectingSkill.skill_content}
              </pre>
            </div>

            <div className="px-6 py-3 border-t border-[#212121] flex items-center justify-end bg-[#080808]">
              <button
                onClick={() => setInspectingSkill(null)}
                className="px-4 py-1.5 rounded-full bg-[#101010] hover:bg-[#212121] text-xs text-[#f3f3f3] border border-[#212121] font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Footer (Hyperstudio Invariant) */}
      <footer className="border-t border-[#212121] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#9c9c9c] font-mono bg-[#080808]">
        <div>
          ContextForge Platform — Course 06016418 Server-Side Web Development (KMITL IT)
        </div>
        <div className="flex items-center gap-4">
          <span>OWASP Top 10 + LLM01 Hardened</span>
          <a
            href="https://github.com/I-have-no-Enemy/ContextForge-"
            target="_blank"
            rel="noreferrer"
            className="text-[#f3f3f3] hover:underline underline-offset-2"
          >
            Source Code
          </a>
        </div>
      </footer>
    </div>
  );
}
