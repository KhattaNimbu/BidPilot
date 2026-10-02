'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  FileText, 
  ShieldAlert, 
  Zap, 
  Edit3, 
  RotateCcw, 
  Check, 
  BarChart2, 
  ArrowLeft,
  Search,
  Filter,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Decision, Requirement, ScoreRecord, Tender } from '@/lib/types';

export default function SingleTenderPage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params.id as string;

  const [activeTab, setActiveTab] = useState<'decision' | 'matrix' | 'buyer'>('decision');
  const [tender, setTender] = useState<Tender | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [jobProgress, setJobProgress] = useState<{ progress: number; message: string }>({ progress: 0, message: '' });

  // Filter & Search state for Matrix
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Drawer / Modal state for Requirement Editing
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [editAnswerText, setEditAnswerText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [tenderId]);

  // Poll background job if processing
  useEffect(() => {
    let interval: any;
    if (processing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/tenders/${tenderId}/status`);
          const data = await res.json();
          setJobProgress({ progress: data.progress, message: data.message });
          if (data.stage === 'complete') {
            setProcessing(false);
            await loadRequirements();
          }
        } catch (err) {
          console.error('Status poll error:', err);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [processing, tenderId]);

  async function loadAllData() {
    setLoading(true);
    try {
      await Promise.all([
        loadTender(),
        loadDecision(),
        loadRequirements(),
        loadScores()
      ]);
    } catch (err) {
      console.error('Error loading tender data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTender() {
    const res = await fetch('/api/tenders');
    const all = await res.json();
    const found = all.find((t: Tender) => t._id === tenderId);
    if (found) setTender(found);
  }

  async function loadDecision() {
    try {
      const res = await fetch(`/api/tenders/${tenderId}/decide`);
      if (res.ok) {
        const d = await res.json();
        setDecision(d);
      }
    } catch (_) {}
  }

  async function loadRequirements() {
    try {
      const res = await fetch(`/api/requirements?tender_id=${tenderId}`);
      if (res.ok) {
        const reqs = await res.json();
        setRequirements(reqs);
      }
    } catch (_) {}
  }

  async function loadScores() {
    try {
      const res = await fetch(`/api/tenders/${tenderId}/score`);
      if (res.ok) {
        const s = await res.json();
        setScores(s);
      }
    } catch (_) {}
  }

  async function runDecisionAgent() {
    setDeciding(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/decide`, { method: 'POST' });
      const d = await res.json();
      setDecision(d);
    } catch (err) {
      console.error('Decision error:', err);
    } finally {
      setDeciding(false);
    }
  }

  async function triggerProcessingJob() {
    setProcessing(true);
    setJobProgress({ progress: 5, message: 'Initiating requirements extraction engine...' });
    try {
      await fetch(`/api/tenders/${tenderId}/process`, { method: 'POST' });
    } catch (err) {
      console.error('Processing trigger error:', err);
      setProcessing(false);
    }
  }

  async function runMockScorer() {
    setScoring(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/score`, { method: 'POST' });
      const newScore = await res.json();
      await loadScores();
    } catch (err) {
      console.error('Scoring error:', err);
    } finally {
      setScoring(false);
    }
  }

  async function handleSaveEdit(action: 'accept' | 'edit' | 'regenerate') {
    if (!selectedReq) return;
    setSavingEdit(true);
    try {
      if (action === 'regenerate') {
        const res = await fetch(`/api/requirements/${selectedReq._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate' })
        });
        const updated = await res.json();
        setSelectedReq(updated);
        setEditAnswerText(updated.draft_answer);
      } else {
        const res = await fetch(`/api/requirements/${selectedReq._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft_answer: editAnswerText,
            reviewer_state: action === 'accept' ? 'Accepted' : 'Edited'
          })
        });
        const updated = await res.json();
        setSelectedReq(updated);
      }
      await loadRequirements();
    } catch (err) {
      console.error('Save edit error:', err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleOverrideRecommendation(newRec: 'Bid' | 'Consider' | 'No-bid') {
    try {
      const res = await fetch(`/api/tenders/${tenderId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_override: newRec, user_notes: 'Manual executive override' })
      });
      const d = await res.json();
      setDecision(d);
    } catch (err) {
      console.error('Override error:', err);
    }
  }

  // Filtered requirements
  const filteredReqs = requirements.filter(r => {
    const matchesSearch = r.text.toLowerCase().includes(searchQuery.toLowerCase()) || r.req_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const mandatoryGaps = requirements.filter(r => r.type === 'Mandatory' && r.status === 'Gap');
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const firstScore = scores.length > 0 ? scores[0] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspaces
            </Link>
          </div>
          <h1 className="text-xl font-bold text-white mt-1 flex items-center gap-3">
            {tender?.title || 'Tender Workspace'}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {tender?.buyer || 'Government Agency'}
            </span>
          </h1>
          <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
            <span>File: {tender?.file_name}</span>
            <span>•</span>
            <span>Pages: {tender?.total_pages || 10}</span>
            <span>•</span>
            <span>Status: <strong className="text-slate-200">{tender?.status || 'Uploaded'}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/api/tenders/${tenderId}/export`}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Excel Matrix (.xlsx)
          </a>
          <button
            onClick={loadAllData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Workspace"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('decision')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'decision'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          F1. Bid / No-Bid Recommendation
          {decision && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              (decision.user_override || decision.recommendation) === 'Bid' ? 'bg-emerald-500/20 text-emerald-300' :
              (decision.user_override || decision.recommendation) === 'Consider' ? 'bg-amber-500/20 text-amber-300' :
              'bg-red-500/20 text-red-300'
            }`}>
              {decision.user_override || decision.recommendation}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'matrix'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          F2 & F3. Compliance Matrix & Drafts
          {requirements.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
              {requirements.length}
            </span>
          )}
          {mandatoryGaps.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
              {mandatoryGaps.length} Gaps
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('buyer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'buyer'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          F4. Mock Buyer Evaluation
          {latestScore && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300">
              {latestScore.overall}/100
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: BID / NO-BID DECISION (F1) */}
      {activeTab === 'decision' && (
        <div className="space-y-6">
          {!decision ? (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 text-center space-y-4">
              <Sparkles className="h-10 w-10 text-blue-400 mx-auto" />
              <h2 className="text-lg font-semibold text-slate-100">Run Bid / No-Bid Decision Agent</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Analyzes tender requirements against saved company profile capabilities, certifications, and live Tavily buyer web research within 2 minutes.
              </p>
              <button
                onClick={runDecisionAgent}
                disabled={deciding}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-xl text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {deciding ? (
                  <>
                    <Zap className="h-4 w-4 animate-spin" />
                    Running Nemotron Ultra Reasoning & Tavily Search...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Bid/No-Bid Decision
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recommendation Banner */}
              <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
                (decision.user_override || decision.recommendation) === 'Bid' ? 'bg-emerald-950/30 border-emerald-500/30' :
                (decision.user_override || decision.recommendation) === 'Consider' ? 'bg-amber-950/30 border-amber-500/30' :
                'bg-red-950/30 border-red-500/30'
              }`}>
                <div className="flex items-center gap-5">
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0 ${
                    (decision.user_override || decision.recommendation) === 'Bid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                    (decision.user_override || decision.recommendation) === 'Consider' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                    'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}>
                    {decision.user_override || decision.recommendation}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Recommendation Verdict {decision.user_override && '(User Overridden)'}
                    </div>
                    <div className="text-xl font-bold text-white mt-0.5">
                      Strategic Fit Score: <span className="text-blue-400">{decision.fit_score} / 100</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">
                      Estimated Effort: <strong className="text-slate-100">{decision.estimated_effort}</strong>
                    </p>
                  </div>
                </div>

                {/* User Override Buttons */}
                <div className="space-y-2 text-right shrink-0">
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Override Verdict:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOverrideRecommendation('Bid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        (decision.user_override || decision.recommendation) === 'Bid'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Bid
                    </button>
                    <button
                      onClick={() => handleOverrideRecommendation('Consider')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        (decision.user_override || decision.recommendation) === 'Consider'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Consider
                    </button>
                    <button
                      onClick={() => handleOverrideRecommendation('No-bid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        (decision.user_override || decision.recommendation) === 'No-bid'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      No-Bid
                    </button>
                  </div>
                </div>
              </div>

              {/* Red Flags Card Grid */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  Top Red Flags & Risk Clauses (Quoted from Tender)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {decision.red_flags.map((rf, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-red-900/30 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-red-400 mb-1">
                          <span>Risk #{idx + 1}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px]">Page {rf.page}</span>
                        </div>
                        <p className="text-xs italic text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                          "{rf.clause}"
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 pt-2 border-t border-slate-900">
                        <strong className="text-slate-300">Rationale:</strong> {rf.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tavily Cited Web Research */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-blue-400" />
                  Cited Buyer Intelligence (Powered by Tavily Web Search)
                </h2>
                <div className="space-y-3">
                  {decision.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-300 group-hover:text-blue-400 flex items-center gap-1.5">
                          {src.title}
                          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 truncate max-w-xs">{src.url}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                        {src.snippet}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPLIANCE MATRIX & DRAFT ANSWERS (F2 & F3) */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Action Header & Progress */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-400" />
                Requirement Extraction & Evidence-Backed Answers
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chunks document by section, matches past bid library evidence, drafts answers with Nemotron Super, and judges status (Met / Partial / Gap).
              </p>
            </div>
            <button
              onClick={triggerProcessingJob}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-5 rounded-xl text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 shrink-0"
            >
              {processing ? (
                <>
                  <Zap className="h-4 w-4 animate-spin" />
                  Processing Job Active...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {requirements.length > 0 ? 'Re-run Requirements Extraction' : 'Extract Requirements & Build Matrix'}
                </>
              )}
            </button>
          </div>

          {/* Job Progress Indicator */}
          {processing && (
            <div className="bg-blue-950/30 border border-blue-500/30 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-blue-300">
                <span>{jobProgress.message || 'Extracting and judging requirements...'}</span>
                <span>{jobProgress.progress}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${jobProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Mandatory Gap Red Alert Banner (PRD Requirement F2) */}
          {mandatoryGaps.length > 0 && (
            <div className="bg-red-950/40 border border-red-500/40 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-200">
                    CRITICAL: {mandatoryGaps.length} Mandatory Requirement Gaps Detected!
                  </h3>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    Mandatory items without evidence lead to immediate buyer disqualification. Accept edits or add evidence to resolve Gaps.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setStatusFilter('Gap'); setTypeFilter('Mandatory'); }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg shrink-0"
              >
                Show Mandatory Gaps
              </button>
            </div>
          )}

          {/* Controls: Search & Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <div className="relative w-full md:w-80">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="Search requirements or IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Met">Met Only</option>
                <option value="Partial">Partial Only</option>
                <option value="Gap">Gap Only</option>
              </select>

              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="Mandatory">Mandatory Only</option>
                <option value="Optional">Optional Only</option>
              </select>
            </div>
          </div>

          {/* Requirements Matrix Table */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-20">ID</th>
                    <th className="py-3 px-4 w-28">Type</th>
                    <th className="py-3 px-4 w-24">Status</th>
                    <th className="py-3 px-4">Requirement & Section</th>
                    <th className="py-3 px-4">Draft Answer</th>
                    <th className="py-3 px-4 w-20">Conf</th>
                    <th className="py-3 px-4 text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredReqs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        {requirements.length === 0 ? 'No requirements extracted yet. Click "Extract Requirements & Build Matrix" above.' : 'No requirements match filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredReqs.map((req) => (
                      <tr 
                        key={req._id} 
                        className={`hover:bg-slate-900/80 transition-colors ${
                          req.type === 'Mandatory' && req.status === 'Gap' ? 'bg-red-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-300">{req.req_id}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            req.type === 'Mandatory' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {req.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            req.status === 'Met' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            req.status === 'Partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {req.status === 'Met' && <CheckCircle2 className="h-3 w-3" />}
                            {req.status === 'Gap' && <XCircle className="h-3 w-3 text-red-400" />}
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-medium text-slate-200 line-clamp-2">{req.text}</p>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {req.section} • Page {req.page}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-sm">
                          {req.draft_answer ? (
                            <p className="text-slate-300 line-clamp-2 italic">{req.draft_answer}</p>
                          ) : (
                            <span className="text-red-400/80 italic font-mono text-[11px]">Blank (Gap: No Evidence)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {Math.round(req.confidence * 100)}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setEditAnswerText(req.draft_answer);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
                          >
                            <Edit3 className="h-3 w-3 text-blue-400" />
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MOCK BUYER EVALUATION (F4) */}
      {activeTab === 'buyer' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-purple-400" />
                Mock Buyer Evaluation & Score Predictor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates the bid draft strictly using published tender criteria and weights via Nemotron Ultra. Re-score updates within 60 seconds.
              </p>
            </div>
            <button
              onClick={runMockScorer}
              disabled={scoring}
              className="bg-purple-600 hover:bg-purple-500 text-white font-medium py-2.5 px-5 rounded-xl text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 shrink-0"
            >
              {scoring ? (
                <>
                  <Zap className="h-4 w-4 animate-spin" />
                  Running Nemotron Ultra Evaluator...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {latestScore ? 'Re-Score Draft' : 'Run Mock Buyer Scoring'}
                </>
              )}
            </button>
          </div>

          {!latestScore ? (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 text-center space-y-4">
              <BarChart2 className="h-10 w-10 text-purple-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-200">No Evaluation Record Yet</h3>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                Click "Run Mock Buyer Scoring" above to extract tender criteria and predict buyer evaluation scores.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Overview Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Predicted Buyer Score</span>
                  <div className="text-4xl font-bold text-purple-400 my-2">
                    {latestScore.overall} <span className="text-lg text-slate-500 font-normal">/ 100</span>
                  </div>
                  <span className="text-xs text-slate-400">Evaluation Version #{latestScore.version}</span>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Before vs After Revisions</span>
                  <div className="flex items-center gap-4 my-2">
                    <div>
                      <span className="text-xs text-slate-500 block">Initial</span>
                      <span className="text-xl font-bold text-slate-400">{firstScore?.overall || latestScore.overall}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-purple-400" />
                    <div>
                      <span className="text-xs text-emerald-400 block">Current</span>
                      <span className="text-xl font-bold text-emerald-400">{latestScore.overall}</span>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400">
                    +{Math.max(0, latestScore.overall - (firstScore?.overall || latestScore.overall))} points improved
                  </span>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Model Used</span>
                  <div className="text-lg font-bold text-slate-200 my-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" />
                    Nemotron Ultra
                  </div>
                  <span className="text-xs text-slate-400">Deep procurement judgment</span>
                </div>
              </div>

              {/* Per-Criterion Breakdown */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
                <h3 className="text-md font-semibold text-slate-100">Criterion-by-Criterion Evaluation</h3>
                <div className="space-y-4">
                  {latestScore.per_criterion.map((c, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-200">{c.name} ({c.weight}% Weight)</span>
                        <span className="font-mono font-bold text-purple-400">{c.score} / 100</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full rounded-full transition-all"
                          style={{ width: `${c.score || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 italic">
                        "{c.justification}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 3 Score Boost Suggestions */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
                <h3 className="text-md font-semibold text-slate-100 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  Top 3 Recommended Fixes to Maximize Score
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {latestScore.suggestions.map((sug, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-amber-900/30 space-y-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Fix #{idx + 1}</span>
                      <p className="text-xs text-slate-300">{sug}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REQUIREMENT EDIT DRAWER / MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-blue-400">{selectedReq.req_id}</span>
                <h3 className="text-base font-bold text-white mt-0.5">{selectedReq.text}</h3>
                <span className="text-xs text-slate-400">
                  {selectedReq.section} • Page {selectedReq.page} • Type: <strong className="text-slate-200">{selectedReq.type}</strong>
                </span>
              </div>
              <button 
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Evidence Found Box */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Evidence Sources Retrieved</span>
              {selectedReq.evidence.length === 0 ? (
                <span className="text-xs text-red-400 italic">No direct evidence found in company profile or past bids library.</span>
              ) : (
                <div className="space-y-2">
                  {selectedReq.evidence.map((ev, idx) => (
                    <div key={idx} className="text-xs text-slate-300 p-2 rounded bg-slate-900 border border-slate-800/60 font-mono">
                      {ev}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Draft Answer Editor */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Draft Response (Accept, Edit, or Regenerate)
              </label>
              <textarea
                rows={5}
                value={editAnswerText}
                onChange={(e) => setEditAnswerText(e.target.value)}
                placeholder="No evidence available. Enter manual answer..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => handleSaveEdit('regenerate')}
                disabled={savingEdit}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5 text-blue-400" />
                Regenerate Answer
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveEdit('edit')}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Save Edit
                </button>

                <button
                  onClick={() => handleSaveEdit('accept')}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept & Save to Past-Bid Library
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
