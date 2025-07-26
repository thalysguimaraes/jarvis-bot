import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  
  // Worker webhook URL
  WORKER_WEBHOOK_URL: process.env.WORKER_WEBHOOK_URL || '',
  
  // Shared secret for webhook authentication
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  
  // Optional: Phone number filter (only process messages from this number)
  PHONE_NUMBER: process.env.PHONE_NUMBER || ''
};

// Validate required configuration
if (!config.WORKER_WEBHOOK_URL) {
  throw new Error('WORKER_WEBHOOK_URL is required');
}

if (!config.WEBHOOK_SECRET) {
  throw new Error('WEBHOOK_SECRET is required');
}