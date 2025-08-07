export interface ClassificationResult {
  type: 'task' | 'note' | 'fund_add' | 'fund_remove' | 'fund_quote' | 'fund_portfolio' | 'fund_update' | 'github_discovery';
  confidence: number;
  reasoning?: string;
}

export interface ClassificationContext {
  transcription: string;
  userId: string;
  timestamp: Date;
}

export interface ClassificationHistory {
  userId: string;
  transcription: string;
  aiClassification: ClassificationResult;
  userOverride?: 'task' | 'note' | 'fund_add' | 'fund_remove' | 'fund_quote' | 'fund_portfolio' | 'fund_update' | 'github_discovery';
  timestamp: Date;
}