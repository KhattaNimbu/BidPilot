export type RequirementStatus = 'Met' | 'Partial' | 'Gap';
export type RequirementType = 'Mandatory' | 'Optional';
export type RecommendationType = 'Bid' | 'Consider' | 'No-bid';
export type ModelType = 'Nano' | 'Super' | 'Ultra';
export type ReviewerState = 'Draft' | 'Accepted' | 'Edited' | 'Rejected';

export interface RedFlag {
  clause: string;
  page: number;
  reason: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface Decision {
  _id?: string;
  tender_id: string;
  recommendation: RecommendationType;
  fit_score: number; // 0-100
  red_flags: RedFlag[];
  estimated_effort: string;
  sources: ResearchSource[];
  created_at: string;
  user_override?: RecommendationType;
  user_notes?: string;
}

export interface Requirement {
  _id: string;
  tender_id: string;
  req_id: string;
  text: string;
  type: RequirementType;
  section: string;
  page: number;
  status: RequirementStatus;
  draft_answer: string;
  evidence: string[];
  confidence: number; // 0.0 to 1.0
  reviewer_state: ReviewerState;
}

export interface EvaluationCriterion {
  name: string;
  weight: number; // percentage e.g. 30
  score?: number; // 0-100
  justification?: string;
}

export interface ScoreRecord {
  _id?: string;
  tender_id: string;
  version: number;
  per_criterion: EvaluationCriterion[];
  overall: number; // 0-100
  suggestions: string[]; // top 3 fixes to raise score
  created_at: string;
}

export interface LLMCall {
  _id?: string;
  tender_id: string;
  agent: string;
  model: ModelType;
  model_name: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost: number;
  input_preview?: string;
  output_preview?: string;
  timestamp: string;
  is_mock?: boolean;
  error?: string;
  retry_count?: number;
}

export interface Tender {
  _id: string;
  title: string;
  buyer: string;
  file_name: string;
  file_content?: string;
  status: 'Uploaded' | 'Decided' | 'Processing' | 'Ready' | 'Error';
  deadline?: string;
  evaluation_criteria?: EvaluationCriterion[];
  created_at: string;
  total_pages?: number;
}

export interface CompanyProfile {
  _id?: string;
  name: string;
  capabilities: string[];
  certifications: string[];
  past_wins: string[];
  capacity_notes: string;
}

export interface PastBidChunk {
  text: string;
  embedding?: number[];
  source_file: string;
}

export interface PastBid {
  _id?: string;
  title: string;
  buyer: string;
  outcome: 'Won' | 'Lost' | 'Archived';
  chunks: PastBidChunk[];
  created_at: string;
}

export interface JobStatus {
  tender_id: string;
  stage: 'idle' | 'splitting' | 'extracting' | 'drafting' | 'judging' | 'complete' | 'error';
  progress: number; // 0 to 100
  message?: string;
  error?: string;
}
