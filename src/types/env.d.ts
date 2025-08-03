export interface Env {
  USER_CONFIGS: KVNamespace;
  
  // Webhook authentication
  WEBHOOK_SECRET: string;
  

  
  // API Keys
  OPENAI_API_KEY: string;
  TODOIST_API_TOKEN: string;
  
  // Obsidian Integration
  OBSIDIAN_STORAGE_TYPE?: 'github' | 'dropbox' | 'gdrive' | 's3';
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  OBSIDIAN_VAULT_PATH?: string;
  OBSIDIAN_NOTE_FORMAT?: 'daily' | 'individual';
  OBSIDIAN_NOTE_PATH?: string;
  
  // Classification settings
  CLASSIFICATION_CONFIDENCE_THRESHOLD?: string;
  CLASSIFICATION_ENABLED?: string;
  
  // Portfolio Tracker
  BRAPI_TOKEN?: string;
  Z_API_INSTANCE_ID?: string;
  Z_API_INSTANCE_TOKEN?: string;
  Z_API_SECURITY_TOKEN?: string;
  PORTFOLIO_WHATSAPP_NUMBER?: string;
  
  // Fund Tracker
  ZAISEN_API_URL?: string;
  ZAISEN_API_KEY?: string;
  
  ENVIRONMENT: 'development' | 'production';
}