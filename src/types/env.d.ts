export interface Env {
  USER_CONFIGS: KVNamespace;
  
  // Webhook authentication
  WEBHOOK_SECRET: string;
  
  // Baileys service URL
  BAILEYS_SERVICE_URL: string;
  
  // API Keys
  OPENAI_API_KEY: string;
  TODOIST_API_TOKEN: string;
  
  ENVIRONMENT: 'development' | 'production';
}