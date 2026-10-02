import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { 
  FileText, 
  BarChart3, 
  BookOpen, 
  Cpu, 
  Zap, 
  Search,
  Bot
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'BidPilot - Agentic Tender Workspace',
  description: 'Turn 100+ page tenders into scored, compliant, ready-to-review bids powered by Nebius Nemotron & Tavily',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden bg-navy-950 text-slate-100">
        {/* Sidebar */}
        <aside className="w-64 border-r border-navy-800 bg-navy-900/90 flex flex-col justify-between p-4 shrink-0">
          <div className="space-y-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-lime-500 via-lime-400 to-emerald-400 p-0.5 shadow-lg shadow-lime-500/20">
                <div className="h-full w-full bg-navy-950 rounded-[10px] flex items-center justify-center">
                  <Bot className="h-5 w-5 text-lime-400" />
                </div>
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-lime-400 bg-clip-text text-transparent">
                  BidPilot
                </span>
                <span className="block text-[10px] font-semibold text-lime-400 uppercase tracking-widest">
                  Agentic Tender Hub
                </span>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="space-y-1">
              <Link 
                href="/" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-navy-800/80 transition-colors"
              >
                <FileText className="h-4 w-4 text-lime-400" />
                Tender Workspaces
              </Link>
              <Link 
                href="/knowledge" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-navy-800/80 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-lime-400" />
                Company & Past Bids
              </Link>
              <Link 
                href="/observability" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-navy-800/80 transition-colors"
              >
                <BarChart3 className="h-4 w-4 text-lime-400" />
                Observability & Traces
              </Link>
            </nav>
          </div>

          {/* Infrastructure badges */}
          <div className="space-y-3 pt-4 border-t border-navy-800/80 text-xs">
            <div className="flex items-center justify-between px-2 text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Cpu className="h-3.5 w-3.5 text-lime-400" />
                Nebius Token Factory
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-lime-400/10 text-lime-400 border border-lime-400/20 font-mono font-semibold">
                Nemotron
              </span>
            </div>
            <div className="flex items-center justify-between px-2 text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Search className="h-3.5 w-3.5 text-lime-400" />
                Tavily Search SDK
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-lime-400/10 text-lime-400 border border-lime-400/20 font-mono font-semibold">
                Active
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-navy-950">
          {/* Header */}
          <header className="h-16 border-b border-navy-800 bg-navy-900/60 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">Track:</span> Best Apps & Agents (Nebius x NVIDIA)
              <span className="text-navy-800">|</span>
              <span className="text-lime-400 font-medium">Bonus: Best Use of Tavily</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-lime-400/10 text-lime-400 border border-lime-400/20">
                <Zap className="h-3 w-3" />
                Model Router: Nano (80%) + Super + Ultra
              </span>
            </div>
          </header>

          {/* Page Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
