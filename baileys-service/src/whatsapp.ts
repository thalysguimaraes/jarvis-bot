import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket,
  proto,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import path from 'path';

interface WhatsAppClientConfig {
  workerWebhookUrl: string;
  webhookSecret: string;
}

export class WhatsAppClient {
  private sock: WASocket | null = null;
  private config: WhatsAppClientConfig;
  private connected = false;
  
  constructor(config: WhatsAppClientConfig) {
    this.config = config;
  }
  
  async initialize() {
    const authPath = path.join(process.cwd(), 'auth_info');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    
    const logger = pino({ level: 'warn' });
    
    this.sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60000
    });
    
    // Handle connection updates
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 Scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(() => this.initialize(), 5000);
        }
        this.connected = false;
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp!');
        this.connected = true;
      }
    });
    
    // Save credentials when updated
    this.sock.ev.on('creds.update', saveCreds);
    
    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        await this.handleMessage(msg);
      }
    });
  }
  
  private async handleMessage(msg: proto.IWebMessageInfo) {
    // Skip if no message or key
    if (!msg.message || !msg.key.remoteJid) return;
    
    // Skip messages from self
    if (msg.key.fromMe) return;
    
    // Skip non-private chats (groups)
    if (!msg.key.remoteJid.endsWith('@s.whatsapp.net')) return;
    
    const messageType = Object.keys(msg.message)[0];
    const from = msg.key.remoteJid;
    const messageId = msg.key.id || '';
    const pushName = msg.pushName || '';
    
    // Only process audio messages
    if (messageType !== 'audioMessage') {
      console.log(`Ignoring ${messageType} message from ${from}`);
      return;
    }
    
    const audioMessage = msg.message.audioMessage;
    if (!audioMessage) return;
    
    try {
      // Download audio
      const buffer = await this.downloadMediaMessage(msg);
      if (!buffer) {
        console.error('Failed to download audio');
        return;
      }
      
      // Convert to base64
      const audioData = buffer.toString('base64');
      
      // Prepare webhook payload
      const webhookPayload = {
        messageId,
        from: from.replace('@s.whatsapp.net', ''),
        to: this.sock?.user?.id.replace(':0@s.whatsapp.net', '') || '',
        timestamp: Date.now(),
        type: 'audio',
        fromMe: false,
        audio: {
          mimetype: audioMessage.mimetype || 'audio/ogg',
          data: audioData,
          duration: audioMessage.seconds
        },
        senderName: pushName,
        senderNumber: from.replace('@s.whatsapp.net', '')
      };
      
      // Send to Worker
      await this.sendToWorker(webhookPayload);
      
    } catch (error) {
      console.error('Error processing audio message:', error);
    }
  }
  
  private async downloadMediaMessage(msg: proto.IWebMessageInfo): Promise<Buffer | null> {
    try {
      if (!this.sock) return null;
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { 
        logger: pino({ level: 'silent' }),
        reuploadRequest: this.sock.updateMediaMessage
      });
      return buffer as Buffer;
    } catch (error) {
      console.error('Error downloading media:', error);
      return null;
    }
  }
  
  private async sendToWorker(payload: any) {
    try {
      const response = await axios.post(
        `${this.config.workerWebhookUrl}/webhook`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.webhookSecret}`
          },
          timeout: 30000
        }
      );
      
      console.log(`✅ Webhook sent to Worker: ${response.status}`);
    } catch (error) {
      console.error('❌ Error sending webhook to Worker:', error);
    }
  }
  
  async sendMessage(to: string, message: string): Promise<string> {
    if (!this.sock || !this.connected) {
      throw new Error('WhatsApp not connected');
    }
    
    // Format phone number
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
    
    // Send message
    const result = await this.sock.sendMessage(jid, { text: message });
    
    return result?.key.id || '';
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.connected = false;
    }
  }
}