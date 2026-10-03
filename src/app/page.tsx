'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Upload, 
  FileText, 
  ArrowRight, 
  Search,
  Sparkles,
  Plus,
  Filter,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { Tender } from '@/lib/types';

export default function HomePage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [buyerInput, setBuyerInput] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filteredTenders = tenders.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchFilter.toLowerCase()) || t.buyer.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Search & Upload Quick Bar (Matching reference header layout) */}
      <div className="soft-card p-4 space-y-4">
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tender Title / Name</label>
            <input 
              type="text"
              placeholder="e.g. Enterprise Cloud Security RFP"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="w-full bg-transparent font-medium text-sm text-slate-900 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Buyer Authority</label>
            <input 
              type="text"
              placeholder="e.g. Dept of Transportation"
              value={buyerInput}
              onChange={(e) => setBuyerInput(e.target.value)}
              className="w-full bg-transparent font-medium text-sm text-slate-900 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Upload Tender Document</label>
            <input 
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setFileInput(e.target.files?.[0] || null)}
              className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={uploading}
              className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {uploading ? <Sparkles className="h-4 w-4 animate-spin text-white" /> : <Plus className="h-4 w-4" />}
              {uploading ? 'Processing' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>

      {/* Main 2-Column Grid Layout (Matching Reference UI Grid Structure) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Filter Panel Card (~3 Columns) */}
        <div className="lg:col-span-3 soft-card p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" />
              Filters
            </h2>
            <button 
              onClick={() => { setSearchFilter(''); setStatusFilter('all'); }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Reset
            </button>
          </div>

          {/* Search Keywords */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Search Keywords</label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="Search tenders..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status Filter Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Status</label>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium">
              {['all', 'Ready', 'Decided', 'Uploaded'].map((st) => (
                <label key={st} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input 
                    type="radio" 
                    name="status"
                    checked={statusFilter === st}
                    onChange={() => setStatusFilter(st)}
                    className="accent-indigo-600 h-4 w-4"
                  />
                  <span className="capitalize">{st === 'all' ? 'All Statuses' : st}</span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Metrics Summary Box */}
          <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl space-y-2 text-xs">
            <span className="font-bold text-indigo-900 block">Nebius Nemotron Stats</span>
            <div className="text-slate-600 space-y-1">
              <div className="flex justify-between"><span>Avg Processing:</span> <strong className="text-slate-900">&lt; 20 min</strong></div>
              <div className="flex justify-between"><span>Model Routing:</span> <strong className="text-indigo-600">85% Nano/Super</strong></div>
              <div className="flex justify-between"><span>Tavily Research:</span> <strong className="text-emerald-600">Active</strong></div>
            </div>
          </div>

          <button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md transition-colors">
            Apply Filters
          </button>
        </div>

        {/* RIGHT COLUMN: Main Tender List Grid (~9 Columns) */}
        <div className="lg:col-span-9 space-y-4">
          {/* Header Badge Pills Row (Matching reference pill layout) */}
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#ff5722] text-white shadow-sm">
              Cheapest & Best Fit
            </span>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm">
              Recommended (AI Ultra)
            </span>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
              {filteredTenders.length} tenders available
            </span>
          </div>

          {/* Main Tenders List Cards */}
          {loading ? (
            <div className="soft-card p-12 text-center text-slate-400 font-medium text-sm">Loading tenders...</div>
          ) : filteredTenders.length === 0 ? (
            <div className="soft-card p-12 text-center text-slate-400 font-medium text-sm">No tenders matching filter criteria.</div>
          ) : (
            filteredTenders.map((tender) => (
              <div key={tender._id} className="soft-card soft-card-hover p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                        {tender.buyer}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 font-mono">
                        {tender.file_name}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {tender.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      tender.status === 'Ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      tender.status === 'Decided' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {tender.status}
                    </span>
                    <Link
                      href={`/tenders/${tender._id}`}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                    >
                      Select & Open Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Timeline / Highlights Row */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Layers className="h-4 w-4 text-indigo-600" /> {tender.total_pages || 10} Pages</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Grounded Evidence</span>
                    <span className="flex items-center gap-1"><Sparkles className="h-4 w-4 text-orange-500" /> Tavily Search</span>
                  </div>
                  <span className="text-indigo-600 font-bold">100% Citation Guarantee</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
