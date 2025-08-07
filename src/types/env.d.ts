export interface Env {
  USER_CONFIGS: KVNamespace;
  
  // Webhook authentication
  WEBHOOK_SECRET?: string;
  
  // API Keys
  OPENAI_API_KEY?: string;
  TODOIST_API_TOKEN?: string;
  
  // Obsidian Integration
  OBSIDIAN_STORAGE_TYPE?: 'github' | 'dropbox' | 'gdrive' | 's3';
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  OBSIDIAN_VAULT_PATH?: string;
  OBSIDIAN_NOTE_FORMAT?: 'daily' | 'individual';
  OBSIDIAN_NOTE_PATH?: string;
  OBSIDIAN_API_KEY?: string;
  
  // Classification settings
  CLASSIFICATION_CONFIDENCE_THRESHOLD?: string;
  CLASSIFICATION_ENABLED?: string;
  
  // Portfolio Tracker
  BRAPI_TOKEN?: string;
  Z_API_INSTANCE_ID?: string;
  Z_API_INSTANCE_TOKEN?: string;
  Z_API_SECURITY_TOKEN?: string;
  Z_API_CLIENT_TOKEN?: string;
  PORTFOLIO_WHATSAPP_NUMBER?: string;
  PORTFOLIO_DATA?: string;
  FUND_PORTFOLIO_DATA?: string;
  
  // Fund Tracker
  ZAISEN_API_URL?: string;
  ZAISEN_API_KEY?: string;
  
  // GitHub Discovery
  GITHUB_DISCOVERY_ENABLED?: string;
  GITHUB_DISCOVERY_WHATSAPP_NUMBER?: string;
  TWITTER_BEARER_TOKEN?: string;
  TWITTER_USERNAME?: string;
  TWITTER_PASSWORD?: string;
  TWITTER_EMAIL?: string;
  
  // Railway API for GitHub Discovery
  GITHUB_SCRAPER_API_URL?: string;
  GITHUB_SCRAPER_API_KEY?: string;
  
  ENVIRONMENT?: 'development' | 'production';
}
