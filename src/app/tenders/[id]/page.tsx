'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  Zap, 
  Edit3, 
  RotateCcw, 
  Check, 
  BarChart2, 
  ArrowLeft,
  Search,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Decision, Requirement, ScoreRecord, Tender } from '@/lib/types';

export default function SingleTenderPage() {
  const params = useParams();
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
      await res.json();
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
    <div className="space-y-6">
      {/* Top Workspace Bar */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspaces
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 flex items-center gap-3">
            {tender?.title || 'Tender Workspace'}
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {tender?.buyer || 'Government Agency'}
            </span>
          </h1>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1">
            <span>File: {tender?.file_name}</span>
            <span>•</span>
            <span>Pages: {tender?.total_pages || 10}</span>
            <span>•</span>
            <span>Status: <strong className="text-slate-900">{tender?.status || 'Uploaded'}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/api/tenders/${tenderId}/export`}
            download
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Excel Matrix (.xlsx)
          </a>
          <button
            onClick={loadAllData}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Refresh Workspace"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Filters & Requirements Panel (~3 Columns) */}
        <div className="lg:col-span-3 soft-card p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" />
              Matrix Filters
            </h2>
            <button 
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTypeFilter('all'); }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Reset
            </button>
          </div>

          {/* Search Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Search Requirement</label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="Req ID or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Requirement Type</label>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="Mandatory">Mandatory Only</option>
              <option value="Optional">Optional Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Compliance Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Met">Met Only</option>
              <option value="Partial">Partial Only</option>
              <option value="Gap">Gap Only</option>
            </select>
          </div>

          {/* Action Trigger Buttons */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button
              onClick={triggerProcessingJob}
              disabled={processing}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md transition-colors disabled:opacity-50"
            >
              {processing ? 'Extracting Job Active...' : 'Run Requirement Extraction'}
            </button>
            <button
              onClick={runMockScorer}
              disabled={scoring}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md transition-colors disabled:opacity-50"
            >
              {scoring ? 'Scoring Draft...' : 'Run Mock Buyer Scoring'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Main Workspace Views (~9 Columns) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Top Pill Navigation Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('decision')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                activeTab === 'decision'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              F1. Bid / No-Bid Recommendation
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                activeTab === 'matrix'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              F2 & F3. Compliance Matrix ({requirements.length})
            </button>

            <button
              onClick={() => setActiveTab('buyer')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                activeTab === 'buyer'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              F4. Buyer Evaluator {latestScore && `(${latestScore.overall}/100)`}
            </button>
          </div>

          {/* TAB 1: BID / NO-BID DECISION (F1) */}
          {activeTab === 'decision' && (
            <div className="space-y-6">
              {!decision ? (
                <div className="soft-card p-10 text-center space-y-4">
                  <Sparkles className="h-10 w-10 text-indigo-600 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900">Run Bid / No-Bid Decision Agent</h2>
                  <p className="text-slate-500 text-xs max-w-md mx-auto">
                    Analyzes tender requirements against saved company profile capabilities, certifications, and live Tavily buyer web research.
                  </p>
                  <button
                    onClick={runDecisionAgent}
                    disabled={deciding}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    {deciding ? 'Running Nemotron Ultra...' : 'Generate Decision'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Verdict Card */}
                  <div className="soft-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-extrabold text-2xl text-indigo-600 shrink-0">
                        {decision.user_override || decision.recommendation}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Recommendation Verdict {decision.user_override && '(User Overridden)'}
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                          Strategic Fit Score: <span className="text-indigo-600">{decision.fit_score} / 100</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Estimated Effort: <strong className="text-slate-800">{decision.estimated_effort}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Override Buttons */}
                    <div className="space-y-2 text-right shrink-0">
                      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Override Verdict:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOverrideRecommendation('Bid')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            (decision.user_override || decision.recommendation) === 'Bid'
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Bid
                        </button>
                        <button
                          onClick={() => handleOverrideRecommendation('Consider')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            (decision.user_override || decision.recommendation) === 'Consider'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Consider
                        </button>
                        <button
                          onClick={() => handleOverrideRecommendation('No-bid')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            (decision.user_override || decision.recommendation) === 'No-bid'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          No-Bid
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Red Flags Card Grid */}
                  <div className="soft-card p-6 space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                      Top Red Flags & Risk Clauses (Quoted from Tender)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {decision.red_flags.map((rf, idx) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-red-600 mb-1">
                              <span>Risk #{idx + 1}</span>
                              <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-mono text-[10px]">Page {rf.page}</span>
                            </div>
                            <p className="text-xs italic text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                              "{rf.clause}"
                            </p>
                          </div>
                          <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                            <strong className="text-slate-800">Rationale:</strong> {rf.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tavily Cited Web Research */}
                  <div className="soft-card p-6 space-y-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ExternalLink className="h-5 w-5 text-indigo-600" />
                      Cited Buyer Intelligence (Powered by Tavily Web Search)
                    </h2>
                    <div className="space-y-3">
                      {decision.sources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1.5">
                              {src.title}
                              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-xs">{src.url}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
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

          {/* TAB 2: COMPLIANCE MATRIX (F2 & F3) */}
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              {mandatoryGaps.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-red-900">
                        CRITICAL: {mandatoryGaps.length} Mandatory Requirement Gaps Detected!
                      </h3>
                      <p className="text-xs text-red-700 mt-0.5">
                        Mandatory items without evidence lead to immediate buyer disqualification. Accept edits or add evidence to resolve Gaps.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setStatusFilter('Gap'); setTypeFilter('Mandatory'); }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full shrink-0 shadow-sm"
                  >
                    Show Mandatory Gaps
                  </button>
                </div>
              )}

              {/* Requirements Matrix Table */}
              <div className="soft-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 font-bold">
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
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredReqs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            No requirements extracted yet or matching filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredReqs.map((req) => (
                          <tr 
                            key={req._id} 
                            className={`hover:bg-slate-50 transition-colors ${
                              req.type === 'Mandatory' && req.status === 'Gap' ? 'bg-red-50/50' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{req.req_id}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                req.type === 'Mandatory' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {req.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                req.status === 'Met' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                req.status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {req.status === 'Met' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                                {req.status === 'Gap' && <XCircle className="h-3 w-3 text-red-600" />}
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <p className="font-semibold text-slate-900 line-clamp-2">{req.text}</p>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {req.section} • Page {req.page}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 max-w-sm">
                              {req.draft_answer ? (
                                <p className="text-slate-600 line-clamp-2 italic">{req.draft_answer}</p>
                              ) : (
                                <span className="text-red-500 italic font-mono text-[11px]">Blank (Gap: No Evidence)</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {Math.round(req.confidence * 100)}%
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedReq(req);
                                  setEditAnswerText(req.draft_answer);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors shadow-sm"
                              >
                                <Edit3 className="h-3 w-3" />
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

          {/* TAB 3: MOCK BUYER SCORER (F4) */}
          {activeTab === 'buyer' && (
            <div className="space-y-6">
              {!latestScore ? (
                <div className="soft-card p-10 text-center space-y-4">
                  <BarChart2 className="h-10 w-10 text-indigo-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">No Evaluation Record Yet</h3>
                  <p className="text-slate-500 text-xs max-w-md mx-auto">
                    Click "Run Mock Buyer Scoring" in the left sidebar to extract tender criteria and predict buyer evaluation scores.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="soft-card p-6 flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Predicted Buyer Score</span>
                      <div className="text-4xl font-extrabold text-indigo-600 my-2">
                        {latestScore.overall} <span className="text-lg text-slate-400 font-normal">/ 100</span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">Evaluation Version #{latestScore.version}</span>
                    </div>

                    <div className="soft-card p-6 flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Before vs After Revisions</span>
                      <div className="flex items-center gap-4 my-2">
                        <div>
                          <span className="text-xs text-slate-400 block">Initial</span>
                          <span className="text-xl font-bold text-slate-500">{firstScore?.overall || latestScore.overall}</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-indigo-600" />
                        <div>
                          <span className="text-xs text-emerald-600 block font-bold">Current</span>
                          <span className="text-xl font-extrabold text-emerald-600">{latestScore.overall}</span>
                        </div>
                      </div>
                      <span className="text-xs text-emerald-600 font-bold">
                        +{Math.max(0, latestScore.overall - (firstScore?.overall || latestScore.overall))} points improved
                      </span>
                    </div>

                    <div className="soft-card p-6 flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Model Used</span>
                      <div className="text-lg font-extrabold text-slate-900 my-2 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-indigo-600" />
                        Nemotron Ultra
                      </div>
                      <span className="text-xs text-slate-500 font-medium">Deep procurement judgment</span>
                    </div>
                  </div>

                  {/* Criteria Breakdown */}
                  <div className="soft-card p-6 space-y-4">
                    <h3 className="text-md font-bold text-slate-900">Criterion-by-Criterion Evaluation</h3>
                    <div className="space-y-4">
                      {latestScore.per_criterion.map((c, idx) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-900">{c.name} ({c.weight}% Weight)</span>
                            <span className="font-mono font-bold text-indigo-600">{c.score} / 100</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all"
                              style={{ width: `${c.score || 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-600 italic">
                            "{c.justification}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* REQUIREMENT EDIT MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="soft-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600">{selectedReq.req_id}</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedReq.text}</h3>
                <span className="text-xs text-slate-500">
                  {selectedReq.section} • Page {selectedReq.page} • Type: <strong className="text-slate-800">{selectedReq.type}</strong>
                </span>
              </div>
              <button 
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-slate-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Evidence Sources Retrieved</span>
              {selectedReq.evidence.length === 0 ? (
                <span className="text-xs text-red-500 italic">No direct evidence found in company profile or past bids library.</span>
              ) : (
                <div className="space-y-2">
                  {selectedReq.evidence.map((ev, idx) => (
                    <div key={idx} className="text-xs text-slate-700 p-2.5 rounded-xl bg-white border border-slate-200 font-mono">
                      {ev}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Draft Response (Accept, Edit, or Regenerate)
              </label>
              <textarea
                rows={5}
                value={editAnswerText}
                onChange={(e) => setEditAnswerText(e.target.value)}
                placeholder="No evidence available. Enter manual answer..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-sans font-medium"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => handleSaveEdit('regenerate')}
                disabled={savingEdit}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5 text-indigo-600" />
                Regenerate Answer
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveEdit('edit')}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Save Edit
                </button>

                <button
                  onClick={() => handleSaveEdit('accept')}
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
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
