import express from 'express';
import { WhatsAppClient } from './whatsapp';
import { config } from './config';

const app = express();
app.use(express.json());

let whatsappClient: WhatsAppClient;

// Initialize WhatsApp client
async function init() {
  console.log('🚀 Starting Baileys WhatsApp Service...');
  
  whatsappClient = new WhatsAppClient({
    workerWebhookUrl: config.WORKER_WEBHOOK_URL,
    webhookSecret: config.WEBHOOK_SECRET
  });
  
  await whatsappClient.initialize();
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok',
    connected: whatsappClient?.isConnected() || false
  });
});

// Send message endpoint (called by Worker)
app.post('/send-message', async (req, res) => {
  try {
    // Validate webhook secret
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${config.WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, message' });
    }
    
    if (!whatsappClient?.isConnected()) {
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    
    const messageId = await whatsappClient.sendMessage(to, message);
    
    return res.json({ 
      success: true, 
      messageId 
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start server
const PORT = config.PORT || 3000;
app.listen(PORT, () => {
  console.log(`📡 HTTP server listening on port ${PORT}`);
});

// Initialize WhatsApp client
init().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await whatsappClient?.disconnect();
  process.exit(0);
});