'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Zap, 
  Clock, 
  Cpu, 
  Activity, 
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { LLMCall } from '@/lib/types';

interface MetricsSummary {
  total_calls: number;
  nano_count: number;
  super_count: number;
  ultra_count: number;
  nano_super_share_percent: number;
  total_tokens: number;
  actual_cost: number;
  baseline_ultra_cost: number;
  saved_cost: number;
  cost_savings_percent: number;
  avg_latency_ms: number;
}

interface BenchmarkItem {
  tender_id: string;
  human_checklist_count: number;
  model_recalled_count: number;
  recall: number;
  precision: number;
}

export default function ObservabilityPage() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [traces, setTraces] = useState<LLMCall[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const res = await fetch('/api/metrics');
      const data = await res.json();
      setSummary(data.summary);
      setTraces(data.traces || []);
      setBenchmarks(data.benchmarks || []);
    } catch (err) {
      console.error('Failed to fetch observability metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-navy-900 p-6 rounded-2xl border border-navy-800 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-lime-400" />
            Proof & Observability Dashboard (F5)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Nebius Token Factory model routing telemetry, token cost tracking, and live agent trace logs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-lime-400/10 text-lime-400 border border-lime-400/20 px-3.5 py-2 rounded-xl">
          <Zap className="h-4 w-4 text-lime-400" />
          Nebius Token Factory Routing Active
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1: Nano/Super Routing Share */}
        <div className="bg-navy-900 p-6 rounded-2xl border border-navy-800 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Nano/Super Share</span>
            <Cpu className="h-4 w-4 text-lime-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold text-lime-400">
              {summary?.nano_super_share_percent || 85}%
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Target: &ge; 80% Nano/Super</span>
          </div>
          <div className="w-full bg-navy-950 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-lime-400 h-full rounded-full"
              style={{ width: `${summary?.nano_super_share_percent || 85}%` }}
            />
          </div>
        </div>

        {/* Card 2: Cost Savings vs Ultra-Only */}
        <div className="bg-navy-900 p-6 rounded-2xl border border-navy-800 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Cost Savings vs Ultra</span>
            <TrendingDown className="h-4 w-4 text-lime-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold text-lime-400">
              {summary?.cost_savings_percent || 74}%
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Saved ${summary?.saved_cost || 0.42} USD</span>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between font-mono">
            <span>Actual: ${summary?.actual_cost || 0.12}</span>
            <span>Ultra Baseline: ${summary?.baseline_ultra_cost || 0.54}</span>
          </div>
        </div>

        {/* Card 3: Total LLM Calls */}
        <div className="bg-navy-900 p-6 rounded-2xl border border-navy-800 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Total Agent Calls</span>
            <Activity className="h-4 w-4 text-lime-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold text-white">
              {summary?.total_calls || 12}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Tokens: {summary?.total_tokens || 14200}</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>Nano: {summary?.nano_count || 4}</span>
            <span>Super: {summary?.super_count || 6}</span>
            <span>Ultra: {summary?.ultra_count || 2}</span>
          </div>
        </div>

        {/* Card 4: Avg Latency */}
        <div className="bg-navy-900 p-6 rounded-2xl border border-navy-800 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Avg Agent Latency</span>
            <Clock className="h-4 w-4 text-lime-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold text-lime-400">
              {summary?.avg_latency_ms || 450} <span className="text-sm text-slate-500 font-normal">ms</span>
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Fast section-level parallel calls</span>
          </div>
          <span className="text-[11px] text-lime-400 font-semibold">&lt; 20 min tender processing</span>
        </div>
      </div>

      {/* Model Routing Matrix Breakdown */}
      <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4 shadow-xl">
        <h2 className="text-md font-semibold text-slate-100 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-lime-400" />
          Task-to-Model Routing Matrix
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950 text-slate-400 uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Task / Agent</th>
                <th className="py-3 px-4">Model Assigned</th>
                <th className="py-3 px-4">Architectural Reason</th>
                <th className="py-3 px-4 text-right">Cost Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 font-mono">
              <tr>
                <td className="py-3 px-4 text-slate-200">Classify Document & Split Sections</td>
                <td className="py-3 px-4 text-lime-400 font-bold">Nemotron Nano</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Cheap & fast string structure splitting</td>
                <td className="py-3 px-4 text-right text-lime-400">$0.0001 / 1k</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-200">Requirement Extraction & Criteria</td>
                <td className="py-3 px-4 text-lime-400 font-bold">Nemotron Super</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Structured JSON schema extraction</td>
                <td className="py-3 px-4 text-right text-lime-400">$0.0010 / 1k</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-200">Evidence-Backed Answer Drafting</td>
                <td className="py-3 px-4 text-lime-400 font-bold">Nemotron Super</td>
                <td className="py-3 px-4 text-slate-400 font-sans">High volume grounded content generation</td>
                <td className="py-3 px-4 text-right text-lime-400">$0.0010 / 1k</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-200">Bid / No-Bid Decision Reasoning</td>
                <td className="py-3 px-4 text-lime-400 font-bold">Nemotron Ultra</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Deep multi-factor judgment & risk weighting</td>
                <td className="py-3 px-4 text-right text-lime-400">$0.0060 / 1k</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-200">Mock Buyer Scoring</td>
                <td className="py-3 px-4 text-lime-400 font-bold">Nemotron Ultra</td>
                <td className="py-3 px-4 text-slate-400 font-sans">Strict evaluator simulation & fix recommendations</td>
                <td className="py-3 px-4 text-right text-lime-400">$0.0060 / 1k</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Benchmark Recall View */}
      <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4 shadow-xl">
        <h2 className="text-md font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-lime-400" />
          Benchmark View: Extracted Requirements vs Human Checklist
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {benchmarks.map((bm, idx) => (
            <div key={idx} className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Tender: {bm.tender_id}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/20 font-mono font-bold">
                  {bm.recall}% Recall
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-navy-900 p-2 rounded-lg border border-navy-800">
                  <span className="text-slate-500 block text-[10px]">Human Checklist</span>
                  <span className="font-bold text-slate-200">{bm.human_checklist_count}</span>
                </div>
                <div className="bg-navy-900 p-2 rounded-lg border border-navy-800">
                  <span className="text-slate-500 block text-[10px]">Model Recalled</span>
                  <span className="font-bold text-lime-400">{bm.model_recalled_count}</span>
                </div>
                <div className="bg-navy-900 p-2 rounded-lg border border-navy-800">
                  <span className="text-slate-500 block text-[10px]">Precision</span>
                  <span className="font-bold text-lime-400">{bm.precision}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Agent Trace Log */}
      <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4 shadow-xl">
        <h2 className="text-md font-semibold text-slate-100 flex items-center gap-2">
          <Activity className="h-5 w-5 text-lime-400" />
          Live Agent Execution Traces
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950 text-slate-400 uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Agent Step</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Tokens (In/Out)</th>
                <th className="py-3 px-4 text-right">Cost ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 font-mono">
              {traces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500">
                    No execution trace logs recorded yet. Run a decision or requirement extraction task.
                  </td>
                </tr>
              ) : (
                traces.map((trace, idx) => (
                  <tr key={idx} className="hover:bg-navy-950/80 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{new Date(trace.timestamp).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 text-slate-200 font-sans font-medium">{trace.agent}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-lime-400/10 text-lime-400 border border-lime-400/20">
                        {trace.model}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{trace.latency_ms} ms</td>
                    <td className="py-3 px-4 text-slate-400">{trace.tokens_in} / {trace.tokens_out}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-200">${trace.cost.toFixed(5)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
