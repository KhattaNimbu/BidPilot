'use client';

import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  ShieldCheck, 
  Award, 
  Plus, 
  Save, 
  FileText, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { CompanyProfile, PastBid } from '@/lib/types';

export default function KnowledgePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [pastBids, setPastBids] = useState<PastBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [certifications, setCertifications] = useState('');
  const [pastWins, setPastWins] = useState('');
  const [capacityNotes, setCapacityNotes] = useState('');

  // Add past bid form
  const [newBidTitle, setNewBidTitle] = useState('');
  const [newBidBuyer, setNewBidBuyer] = useState('');
  const [newBidQA, setNewBidQA] = useState('');
  const [addingBid, setAddingBid] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [profRes, bidsRes] = await Promise.all([
        fetch('/api/company-profile'),
        fetch('/api/past-bids')
      ]);
      const profData = await profRes.json();
      const bidsData = await bidsRes.json();

      setProfile(profData);
      setPastBids(bidsData);

      setName(profData.name || '');
      setCapabilities((profData.capabilities || []).join('\n'));
      setCertifications((profData.certifications || []).join('\n'));
      setPastWins((profData.past_wins || []).join('\n'));
      setCapacityNotes(profData.capacity_notes || '');
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updatedProfile: CompanyProfile = {
        name,
        capabilities: capabilities.split('\n').map(s => s.trim()).filter(Boolean),
        certifications: certifications.split('\n').map(s => s.trim()).filter(Boolean),
        past_wins: pastWins.split('\n').map(s => s.trim()).filter(Boolean),
        capacity_notes: capacityNotes
      };

      await fetch('/api/company-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
      await loadData();
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddPastBid(e: React.FormEvent) {
    e.preventDefault();
    if (!newBidTitle || !newBidQA) return;
    setAddingBid(true);
    try {
      await fetch('/api/past-bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newBidTitle,
          buyer: newBidBuyer || 'Historical Tender',
          outcome: 'Won',
          text: newBidQA
        })
      });
      setNewBidTitle('');
      setNewBidBuyer('');
      setNewBidQA('');
      await loadData();
    } catch (err) {
      console.error('Add past bid error:', err);
    } finally {
      setAddingBid(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-400" />
            Company Knowledge Base & Past Bids Library
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Grounds BidPilot agents (F1 decision & F3 drafting) with authoritative company capabilities, certifications, and historical winning answers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Profile Form */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Company Credentials & Certifications Profile
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Company Name</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Capabilities (1 per line)</label>
              <textarea 
                rows={4}
                value={capabilities}
                onChange={(e) => setCapabilities(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Certifications (1 per line)</label>
              <textarea 
                rows={3}
                value={certifications}
                onChange={(e) => setCertifications(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Past Wins & Case Studies (1 per line)</label>
              <textarea 
                rows={3}
                value={pastWins}
                onChange={(e) => setPastWins(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Capacity Notes</label>
              <input 
                type="text"
                value={capacityNotes}
                onChange={(e) => setCapacityNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingProfile ? 'Saving Profile...' : 'Save Company Profile'}
            </button>
          </form>
        </div>

        {/* Past Bids Library */}
        <div className="space-y-6">
          {/* Add Past Bid Form */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />
              Add Past Winning Bid Answer
            </h2>
            <form onSubmit={handleAddPastBid} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="text"
                  placeholder="Bid Title e.g. Dept of Defense Cloud Bid"
                  value={newBidTitle}
                  onChange={(e) => setNewBidTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <input 
                  type="text"
                  placeholder="Buyer e.g. Dept of Defense"
                  value={newBidBuyer}
                  onChange={(e) => setNewBidBuyer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <textarea 
                rows={4}
                placeholder="Requirement & Answer Pair e.g. Requirement: Must be ISO 27001 certified. Answer: Apex maintains certified ISO 27001..."
                value={newBidQA}
                onChange={(e) => setNewBidQA(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              />

              <button
                type="submit"
                disabled={addingBid}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {addingBid ? 'Adding to Library...' : 'Save Answer to Knowledge Base'}
              </button>
            </form>
          </div>

          {/* Past Bids List */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-400" />
              Indexed Past Bids & Evidence Chunks
            </h2>

            <div className="space-y-3">
              {pastBids.map((bid, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{bid.title}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      {bid.outcome}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Buyer: {bid.buyer}</span>
                  <div className="space-y-1 pt-1">
                    {bid.chunks.map((chunk, cIdx) => (
                      <div key={cIdx} className="text-[11px] text-slate-300 p-2 rounded bg-slate-900 border border-slate-800/60 font-mono line-clamp-3">
                        {chunk.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
