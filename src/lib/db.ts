import { MongoClient, Db } from 'mongodb';
import { CompanyProfile, Decision, LLMCall, PastBid, Requirement, ScoreRecord, Tender, JobStatus } from './types';

interface MemoryStore {
  companyProfile: CompanyProfile;
  pastBids: PastBid[];
  tenders: Map<string, Tender>;
  decisions: Map<string, Decision>;
  requirements: Map<string, Requirement[]>;
  scores: Map<string, ScoreRecord[]>;
  calls: LLMCall[];
  jobs: Map<string, JobStatus>;
}

const memoryStore: MemoryStore = {
  companyProfile: {
    name: "Apex Defense & Tech Solutions",
    capabilities: [
      "Enterprise Cloud Migration & Infrastructure Management",
      "AI/ML Model Fine-Tuning & Pipeline Optimization",
      "Cybersecurity Monitoring & SOC Tier 3 Incident Response",
      "SLA 99.99% Managed Services & 24/7 Global Support",
      "HIPAA & Healthcare Patient Analytics Compliance"
    ],
    certifications: [
      "ISO 27001 Certified Information Security Management",
      "SOC 2 Type II Audited & Certified",
      "AWS Premier Consulting Partner & NVIDIA Certified Solution Provider",
      "FedRAMP Moderate Ready",
      "CMMI Level 3 Dev & Services"
    ],
    past_wins: [
      "Department of Energy $14M Cloud Modernization Contract (2025)",
      "Global Health System HIPAA AI Analytics Portal $8.5M (2024)",
      "FinTech Core Banking Cloud Migration $11M (2024)"
    ],
    capacity_notes: "50+ cleared senior cloud engineers available immediately. Dedicated bid team with 92% win rate on government RFPs."
  },
  pastBids: [
    {
      title: "Global Health System AI & Data Analytics RFP",
      buyer: "Global Health System",
      outcome: "Won",
      created_at: new Date().toISOString(),
      chunks: [
        {
          text: "Requirement: Compliance with HIPAA and SOC 2 Type II is mandatory. Answer: Apex Defense & Tech Solutions maintains current SOC 2 Type II certification (audited annually) and strictly adheres to HIPAA security rules with encrypted data-at-rest (AES-256) and in-transit (TLS 1.3). Audit reports available upon request.",
          source_file: "GlobalHealth_Winning_Bid_2024.pdf"
        },
        {
          text: "Requirement: Support SLA response times within 15 minutes for P1 incidents. Answer: Apex operates a 24/7/365 follow-the-sun SOC with dedicated Tier 3 engineers guaranteeing a 15-minute response SLA for critical P1 incidents with automatic executive escalation.",
          source_file: "GlobalHealth_Winning_Bid_2024.pdf"
        },
        {
          text: "Requirement: Disaster Recovery and RTO/RPO requirements under 1 hour. Answer: Apex implements automated multi-region failover architecture with continuous database replication achieving sub-15 minute RTO and zero data loss RPO (RPO = 0).",
          source_file: "DeptOfEnergy_Cloud_Bid_2025.pdf"
        }
      ]
    }
  ],
  tenders: new Map(),
  decisions: new Map(),
  requirements: new Map(),
  scores: new Map(),
  calls: [],
  jobs: new Map()
};

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('localhost:27017')) {
    return null; // Use memory store for instant offline functionality
  }
  try {
    if (!client) {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      dbInstance = client.db();
    }
    return dbInstance;
  } catch (err) {
    console.warn("MongoDB connection failed, falling back to memory store:", err);
    return null;
  }
}

export const dbService = {
  // Company Profile
  async getCompanyProfile(): Promise<CompanyProfile> {
    const db = await getDb();
    if (db) {
      const res = await db.collection<any>('company_profile').findOne({});
      if (res) return res;
    }
    return memoryStore.companyProfile;
  },

  async updateCompanyProfile(profile: CompanyProfile): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('company_profile').updateOne({}, { $set: profile }, { upsert: true });
    }
    memoryStore.companyProfile = profile;
  },

  // Tenders
  async createTender(tender: Tender): Promise<Tender> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('tenders').insertOne(tender as any);
    }
    memoryStore.tenders.set(tender._id, tender);
    return tender;
  },

  async getTender(id: string): Promise<Tender | null> {
    const db = await getDb();
    if (db) {
      const t = await db.collection<any>('tenders').findOne({ _id: id });
      if (t) return t as Tender;
    }
    return memoryStore.tenders.get(id) || null;
  },

  async updateTender(id: string, update: Partial<Tender>): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('tenders').updateOne({ _id: id }, { $set: update });
    }
    const existing = memoryStore.tenders.get(id);
    if (existing) {
      memoryStore.tenders.set(id, { ...existing, ...update });
    }
  },

  async listTenders(): Promise<Tender[]> {
    const db = await getDb();
    if (db) {
      return (await db.collection<any>('tenders').find({}).sort({ created_at: -1 }).toArray()) as Tender[];
    }
    return Array.from(memoryStore.tenders.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  // Decisions
  async saveDecision(decision: Decision): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('decisions').updateOne({ tender_id: decision.tender_id }, { $set: decision }, { upsert: true });
    }
    memoryStore.decisions.set(decision.tender_id, decision);
  },

  async getDecision(tenderId: string): Promise<Decision | null> {
    const db = await getDb();
    if (db) {
      const d = await db.collection<any>('decisions').findOne({ tender_id: tenderId });
      if (d) return d as Decision;
    }
    return memoryStore.decisions.get(tenderId) || null;
  },

  // Requirements
  async saveRequirements(tenderId: string, reqs: Requirement[]): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('requirements').deleteMany({ tender_id: tenderId });
      if (reqs.length > 0) {
        await db.collection<any>('requirements').insertMany(reqs as any[]);
      }
    }
    memoryStore.requirements.set(tenderId, reqs);
  },

  async getRequirements(tenderId: string): Promise<Requirement[]> {
    const db = await getDb();
    if (db) {
      return (await db.collection<any>('requirements').find({ tender_id: tenderId }).toArray()) as Requirement[];
    }
    return memoryStore.requirements.get(tenderId) || [];
  },

  async updateRequirement(reqId: string, update: Partial<Requirement>): Promise<Requirement | null> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('requirements').updateOne({ _id: reqId }, { $set: update });
    }
    for (const [tId, reqs] of Array.from(memoryStore.requirements.entries())) {
      const idx = reqs.findIndex(r => r._id === reqId);
      if (idx !== -1) {
        reqs[idx] = { ...reqs[idx], ...update };
        memoryStore.requirements.set(tId, reqs);
        return reqs[idx];
      }
    }
    return null;
  },

  // Scores
  async saveScore(score: ScoreRecord): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('scores').insertOne(score as any);
    }
    const existing = memoryStore.scores.get(score.tender_id) || [];
    existing.push(score);
    memoryStore.scores.set(score.tender_id, existing);
  },

  async getScores(tenderId: string): Promise<ScoreRecord[]> {
    const db = await getDb();
    if (db) {
      return (await db.collection<any>('scores').find({ tender_id: tenderId }).sort({ version: 1 }).toArray()) as ScoreRecord[];
    }
    return memoryStore.scores.get(tenderId) || [];
  },

  // LLM Calls / Observability Trace
  async logCall(call: LLMCall): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('calls').insertOne(call as any);
    }
    memoryStore.calls.unshift(call);
    if (memoryStore.calls.length > 200) {
      memoryStore.calls.pop();
    }
  },

  async getCalls(tenderId?: string): Promise<LLMCall[]> {
    const db = await getDb();
    if (db) {
      const query = tenderId ? { tender_id: tenderId } : {};
      return (await db.collection<any>('calls').find(query).sort({ timestamp: -1 }).toArray()) as LLMCall[];
    }
    if (tenderId) {
      return memoryStore.calls.filter(c => c.tender_id === tenderId);
    }
    return memoryStore.calls;
  },

  // Past Bids Library
  async getPastBids(): Promise<PastBid[]> {
    const db = await getDb();
    if (db) {
      return (await db.collection<any>('past_bids').find({}).toArray()) as PastBid[];
    }
    return memoryStore.pastBids;
  },

  async addPastBid(bid: PastBid): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('past_bids').insertOne(bid as any);
    }
    memoryStore.pastBids.push(bid);
  },

  // Job Progress
  async setJobStatus(status: JobStatus): Promise<void> {
    const db = await getDb();
    if (db) {
      await db.collection<any>('jobs').updateOne({ tender_id: status.tender_id }, { $set: status }, { upsert: true });
    }
    memoryStore.jobs.set(status.tender_id, status);
  },

  async getJobStatus(tenderId: string): Promise<JobStatus | null> {
    const db = await getDb();
    if (db) {
      const j = await db.collection<any>('jobs').findOne({ tender_id: tenderId });
      if (j) return j as JobStatus;
    }
    return memoryStore.jobs.get(tenderId) || null;
  }
};
