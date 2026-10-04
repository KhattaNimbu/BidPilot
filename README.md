# BidPilot - Agentic Tender & Bid Intelligence Workspace

> **Track**: Best Apps and Agents (Nebius x NVIDIA Hackathon)  
> **Bonus Target**: Best Use of Tavily  
> **Infrastructure**: Powered by **Nebius Token Factory** (Nemotron-70B, Llama-3.1-8B) & **Tavily Search API**

BidPilot turns 100+ page public and enterprise tenders into scored, fully compliant, ready-to-review bids in under 20 minutes, while providing an executive Bid / No-Bid recommendation with cited red flags.

---

## Architecture & Model Routing

BidPilot uses a cost-aware multi-model hierarchy that routes tasks to the most cost-effective model, achieving **>74% token cost savings** compared to an Ultra-only baseline and directing **>=80% of tokens to Nano & Super**:

| Agent / Task | Assigned Model | Model ID on Nebius | Architectural Rationale | Cost Tier |
| :--- | :--- | :--- | :--- | :--- |
| **Section & Structure Classifier (F2)** | **Nemotron Nano** | meta-llama/Meta-Llama-3.1-8B-Instruct | Fast structural parsing and document hierarchy | .0001 / 1k |
| **Requirement Extractor (F2)** | **Nemotron Super** | 
vidia/llama-3.1-nemotron-70b-instruct | High-accuracy structured JSON requirement extraction | .0010 / 1k |
| **Evidence-Backed Drafter (F3)** | **Nemotron Super** | 
vidia/llama-3.1-nemotron-70b-instruct | High-volume grounded text drafting with source citations | .0010 / 1k |
| **First-Pass Compliance Judge (F2)** | **Nemotron Super** | 
vidia/llama-3.1-nemotron-70b-instruct | Standard capability alignment check (Met / Partial / Gap) | .0010 / 1k |
| **Borderline Compliance Escalation** | **Nemotron Ultra** | meta-llama/Meta-Llama-3.1-70B-Instruct | High-stakes audit on borderline mandatory requirements | .0060 / 1k |
| **Bid / No-Bid Decision Agent (F1)** | **Nemotron Ultra** | meta-llama/Meta-Llama-3.1-70B-Instruct | Deep multi-factor win probability, risk & red flags | .0060 / 1k |
| **Mock Buyer Evaluator (F4)** | **Nemotron Ultra** | meta-llama/Meta-Llama-3.1-70B-Instruct | Strict evaluator simulation, scoring & high-impact fixes | .0060 / 1k |

---

## Key Features

1. **F1: Bid / No-Bid Decision & Red Flags**:
   - Executive recommendation badge (\Bid\, \Consider\, \No-bid\) and strategic fit score (0-100).
   - Scans full document for high-risk clauses (liquidated damages, mandatory bonding, CONUS residency) with grounded verification.
   - Real-time Tavily web research on buyer award patterns and vendor complaints.
   - Executive override control for human-in-the-loop decisions.

2. **F2: Requirement Extraction & Compliance Matrix**:
   - Zero-truncation sliding window chunker handles 100+ page documents.
   - Categorizes mandatory vs optional requirements.
   - Color-coded compliance badges (\Met\ in green, \Partial\ in amber, \Gap\ in red).
   - Mandatory Gaps automatically surface at the top of the review queue.

3. **F3: Evidence-Backed Answer Drafting**:
   - Semantic n-gram and domain-clustered cosine similarity matching against company past bids and certifications.
   - Zero-hallucination policy: leaves draft blank if evidence similarity is insufficient.
   - Interactive review drawer: Accept, Edit, or Regenerate. Accepted edits feed back into the past-bid library for continuous learning.

4. **F4: Mock Buyer Scoring & Fix Recommendations**:
   - Identifies evaluation criteria and weights across the entire document.
   - Simulates buyer evaluator board, providing per-criterion grades, overall score gauge, and top 3 recommended fixes.

5. **F5: Proof & Observability Dashboard**:
   - Live telemetry showing model distribution (Nano vs Super vs Ultra), token savings vs Ultra baseline, and latency.
   - Full trace logs with model name, tokens, latency, cost, and input/output previews.
   - Dynamic benchmark view evaluating model recall and precision against ground-truth human checklists.

---

## Environment Configuration

Create a \.env.local\ file in the root directory:

\\\env
# Nebius Token Factory
NEBIUS_API_KEY=your_nebius_api_key_here
NEBIUS_BASE_URL=https://api.studio.nebius.ai/v1/

# Model IDs
NANO_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
SUPER_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
ULTRA_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct

# Tavily Search API
TAVILY_API_KEY=your_tavily_api_key_here

# Mode: set to false for real Nebius & Tavily execution; true for mock evaluation
MOCK_MODE=false
\\\

---

## Quickstart

\\\ash
# Install dependencies
npm install

# Build production bundle
npm run build

# Start development server
npm run dev
\\\

Open [http://localhost:3000](http://localhost:3000) to view the application.
