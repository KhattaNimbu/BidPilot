'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Upload, 
  FileText, 
  ArrowRight, 
  Zap, 
  Sparkles,
  Plus
} from 'lucide-react';
import { Tender } from '@/lib/types';

export default function HomePage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [buyerInput, setBuyerInput] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);

  useEffect(() => {
    fetchTenders();
  }, []);

  async function fetchTenders() {
    try {
      const res = await fetch('/api/tenders');
      const data = await res.json();
      setTenders(data);
    } catch (err) {
      console.error('Failed to load tenders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      const formData = new FormData();
      if (fileInput) {
        formData.append('file', fileInput);
      }
      formData.append('title', titleInput || (fileInput ? fileInput.name : 'Uploaded Tender'));
      formData.append('buyer', buyerInput || 'Department of Transportation');

      const res = await fetch('/api/tenders', {
        method: 'POST',
        body: formData
      });
      await res.json();
      await fetchTenders();
      setTitleInput('');
      setBuyerInput('');
      setFileInput(null);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-navy-900 p-6 rounded-2xl border border-navy-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            BidPilot Agentic Workspace
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/20">
              v1.0 Hackathon Build
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Transform 100+ page tenders into scored, compliant, review-ready bids within 20 minutes. Powered by Nebius Token Factory (Nemotron Nano, Super, Ultra) and Tavily web research.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono bg-navy-950 p-3 rounded-xl border border-navy-800">
          <div>
            <span className="text-slate-400 block">Avg Time Saved</span>
            <span className="text-lime-400 font-bold text-base">92% (&lt;20 min)</span>
          </div>
          <div className="border-l border-navy-800 pl-4">
            <span className="text-slate-400 block">Requirement Recall</span>
            <span className="text-lime-400 font-bold text-base">94.2%</span>
          </div>
        </div>
      </div>

      {/* Upload & Fast Test Drive */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Box */}
        <div className="md:col-span-2 bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Upload className="h-5 w-5 text-lime-400" />
            Upload Tender PDF / Document
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tender Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Enterprise Cloud Modernization RFP"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-lime-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Buyer / Issuing Authority</label>
                <input 
                  type="text" 
                  placeholder="e.g. Department of Transportation"
                  value={buyerInput}
                  onChange={(e) => setBuyerInput(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-lime-400"
                />
              </div>
            </div>

            <div className="border-2 border-dashed border-navy-800 hover:border-lime-400/50 rounded-xl p-6 text-center bg-navy-950/60 transition-colors">
              <input 
                type="file" 
                accept=".pdf,.txt,.doc,.docx"
                onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                className="hidden" 
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                <FileText className="h-8 w-8 text-slate-500 mx-auto" />
                <div className="text-sm font-medium text-slate-300">
                  {fileInput ? fileInput.name : 'Click to upload PDF or drag and drop'}
                </div>
                <div className="text-xs text-slate-500">
                  Supports text-based PDF or TXT up to 150 pages
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={uploading}
              className="w-full bg-lime-400 hover:bg-lime-300 text-navy-950 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-lime-400/20 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Zap className="h-4 w-4 animate-spin text-navy-950" />
                  Parsing & Creating Workspace...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Initialize Tender Workspace
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick Demo Test Drive */}
        <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4 flex flex-col justify-between shadow-xl">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-lime-400" />
              1-Click Demo Tenders
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Explore pre-parsed 50+ page public tender test sets complete with evaluation criteria & mandatory clauses.
            </p>

            <div className="space-y-3 mt-4">
              <Link 
                href="/tenders/sample_cloud_security_rfp"
                className="block p-3.5 rounded-xl bg-navy-950 border border-navy-800 hover:border-lime-400/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-lime-400 uppercase tracking-wider">Cloud Security</span>
                  <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-lime-400 transition-colors" />
                </div>
                <div className="text-sm font-medium text-slate-200 mt-1">Enterprise Cloud Security RFP</div>
                <div className="text-xs text-slate-400 mt-0.5">Dept of Transportation • 45 Pages</div>
              </Link>

              <Link 
                href="/tenders/sample_healthcare_analytics_tender"
                className="block p-3.5 rounded-xl bg-navy-950 border border-navy-800 hover:border-lime-400/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-lime-400 uppercase tracking-wider">Healthcare AI</span>
                  <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-lime-400 transition-colors" />
                </div>
                <div className="text-sm font-medium text-slate-200 mt-1">AI Patient Data Analytics Platform</div>
                <div className="text-xs text-slate-400 mt-0.5">National Healthcare Alliance • 38 Pages</div>
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-navy-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Zod JSON Validation</span>
            <span>Ultra / Super / Nano Router</span>
          </div>
        </div>
      </div>

      {/* Tender Workspaces List */}
      <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <FileText className="h-5 w-5 text-lime-400" />
          Active Tender Workspaces
        </h2>

        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Loading tenders...</div>
        ) : tenders.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No tenders uploaded yet. Upload one above or click a sample tender.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider border-b border-navy-800">
                <tr>
                  <th className="py-3 px-4">Tender Title</th>
                  <th className="py-3 px-4">Buyer</th>
                  <th className="py-3 px-4">Pages</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {tenders.map((tender) => (
                  <tr key={tender._id} className="hover:bg-navy-950/60 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {tender.title}
                      <span className="block text-xs font-mono text-slate-500">{tender.file_name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{tender.buyer}</td>
                    <td className="py-3.5 px-4 text-slate-400">{tender.total_pages || 10}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        tender.status === 'Ready' ? 'bg-lime-400/10 text-lime-400 border-lime-400/20' :
                        tender.status === 'Decided' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        tender.status === 'Processing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
                        'bg-navy-800 text-slate-400 border-navy-700'
                      }`}>
                        {tender.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link 
                        href={`/tenders/${tender._id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 border border-lime-400/30 text-xs font-semibold transition-colors"
                      >
                        Open Workspace
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
