import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { 
  Cpu, 
  Search,
  Bot,
  Settings,
  Bell,
  User
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
    <html lang="en">
      <body className="min-h-screen bg-[#f1f4f9] text-slate-800 antialiased flex flex-col">
        {/* Top Header Bar matching reference design */}
        <header className="sticky top-0 z-40 bg-[#f1f4f9]/90 backdrop-blur-md px-6 py-3 border-b border-slate-200/80">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Bot className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                bidpilot
              </span>
            </Link>

            {/* Top Navigation Bar Pill Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-white/80 p-1.5 rounded-full border border-slate-200/80 shadow-sm text-xs font-semibold text-slate-600">
              <Link 
                href="/" 
                className="px-4 py-2 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold"
              >
                Tender Workspaces
              </Link>
              <Link 
                href="/knowledge" 
                className="px-4 py-2 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold"
              >
                Company & Past Bids
              </Link>
              <Link 
                href="/observability" 
                className="px-4 py-2 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold"
              >
                Observability & Traces
              </Link>
            </nav>

            {/* Infrastructure Badges & Profile */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <span className="flex items-center gap-1 text-slate-800">
                  <Cpu className="h-3.5 w-3.5 text-indigo-600" />
                  Nebius Token Factory
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-slate-800">
                  <Search className="h-3.5 w-3.5 text-indigo-600" />
                  Tavily Search
                </span>
              </div>

              {/* Action Icons */}
              <button className="h-9 w-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors">
                <Settings className="h-4 w-4" />
              </button>
              <button className="h-9 w-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-orange-500" />
              </button>
              <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-md">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <div className="flex-1 max-w-[1440px] w-full mx-auto p-6">
          {children}
        </div>
      </body>
    </html>
  );
}
