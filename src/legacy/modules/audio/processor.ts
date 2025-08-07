import { ZApiWebhookPayload } from '@/services/whatsapp/types';
import { TodoistClient } from '@/modules/todo/client';
import { parseTaskFromTranscription } from '@/modules/todo/taskParser';
import { TranscriptionClassifier, ClassificationResult } from '@/modules/classification';

import { Config } from '@/utils/config';

interface AudioContext {
  env: any;
  userId: string;
  todoistToken?: string;
  zapiPayload: ZApiWebhookPayload;
}

export async function processAudioMessage(
  payload: ZApiWebhookPayload,
  context: AudioContext
): Promise<void> {
  // Get the user phone number from various possible fields - moved outside try block
  const userPhone = payload.from || payload.phone || payload.senderNumber;
  
  try {
    if (!payload.audio) {
      throw new Error('No audio data in payload');
    }
    
    let audioBuffer: ArrayBuffer;
    
    // Handle both URL-based and base64-encoded audio
    if (payload.audio.audioUrl) {
      // Download audio from Z-API URL (legacy format)
      const audioResponse = await fetch(payload.audio.audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      audioBuffer = await audioResponse.arrayBuffer();
    } else if (payload.audio.data) {
      // Decode base64 audio data (new format)
      const base64Data = payload.audio.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBuffer = bytes.buffer;
    } else {
      throw new Error('No audio URL or data found in payload');
    }
    
    console.log('Audio info:', {
      originalMimeType: payload.audio.mimeType || payload.audio.mimetype,
      bufferSize: audioBuffer.byteLength,
      bufferSizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
      duration: payload.audio.seconds || payload.audio.duration
    });
    
    // Convert to blob for OpenAI
    const audioMimeType = payload.audio.mimeType || payload.audio.mimetype || 'audio/ogg';
    const audioBlob = new Blob([audioBuffer], { type: audioMimeType });
    
    console.log('Sending to Whisper:', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type
    });
    
    // Transcribe with OpenAI Whisper
    const transcription = await transcribeAudio(audioBlob, context.env);
    
    if (!transcription || transcription.trim().length === 0) {
      await sendMessage(
        context,
        userPhone,
        '❌ Não consegui transcrever o áudio. Por favor, tente falar mais claramente.'
      );
      return;
    }
    
    // Classify and process the transcribed text
    await classifyAndProcess(transcription, payload, context, userPhone);
    
  } catch (error) {
    console.error('Audio processing error:', error);
    
    // Send appropriate error message to user
    let errorMessage = '❌ Erro ao processar o áudio.';
    
    if (error.message?.includes('API key not configured')) {
      errorMessage = '❌ Bot não está configurado corretamente. Por favor, configure a chave da API OpenAI.';
    } else if (error.message?.includes('Invalid OpenAI API key')) {
      errorMessage = '❌ Chave da API OpenAI inválida. Por favor, verifique a configuração.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = '❌ O processamento do áudio demorou muito. Por favor, tente com um áudio mais curto.';
    } else if (error.message?.includes('Failed to download audio')) {
      errorMessage = '❌ Erro ao baixar o áudio. Por favor, tente novamente.';
    }
    
    await sendMessage(context, userPhone, errorMessage);
    throw error;
  }
}

async function transcribeAudio(audioBlob: Blob, env: any): Promise<string> {
  // Check if API key is configured
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
  }
  
  const formData = new FormData();
  
  // Determine file extension based on mime type
  const mimeToExt: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm'
  };
  
  const fileExt = mimeToExt[audioBlob.type] || 'mp3';
  const fileName = `audio.${fileExt}`;
  
  console.log('Whisper request:', {
    fileName,
    fileSize: audioBlob.size,
    mimeType: audioBlob.type,
    hasApiKey: !!env.OPENAI_API_KEY
  });
  
  formData.append('file', audioBlob, fileName);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Transcription timeout after 30 seconds');
      }
      throw error;
    }
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', {
        status: response.status,
        error,
        hasApiKey: !!env.OPENAI_API_KEY,
        apiKeyLength: env.OPENAI_API_KEY?.length
      });
      
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY configuration.');
      }
      
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }
    
    const result = await response.json() as { text: string };
    console.log('Transcription result:', {
      text: result.text,
      length: result.text.length
    });
    
    return result.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

async function classifyAndProcess(
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext,
  userPhone: string
): Promise<void> {
  let classification: ClassificationResult | null = null;
  
  // Check if classification is enabled
  if (Config.isClassificationEnabled(context.env)) {
    const classifier = new TranscriptionClassifier(
      context.env.OPENAI_API_KEY,
      Config.getClassificationThreshold(context.env)
    );
    
    try {
      classification = await classifier.classify({
        transcription,
        userId: userPhone,
        timestamp: new Date()
      });
      
      const getClassificationDisplay = (type: string) => {
        switch (type) {
          case 'task': return { emoji: '📋', text: 'Tarefa' };
          case 'note': return { emoji: '📝', text: 'Nota' };
          case 'fund_add': return { emoji: '📈', text: 'Adicionar Fundo' };
          case 'fund_remove': return { emoji: '📉', text: 'Remover Fundo' };
          case 'fund_quote': return { emoji: '💰', text: 'Cotação de Fundo' };
          case 'fund_portfolio': return { emoji: '📊', text: 'Portfolio de Fundos' };
          case 'fund_update': return { emoji: '🔄', text: 'Atualizar Fundo' };
          default: return { emoji: '📋', text: 'Tarefa' };
        }
      };
      
      const { emoji: classificationEmoji, text: classificationText } = getClassificationDisplay(classification.type);
      const confidenceText = classification.confidence >= 0.8 ? '✅' : '⚠️';
      
      console.log('Classification result:', {
        type: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning
      });
      
      await sendMessage(
        context,
        userPhone,
        `${classificationEmoji} Transcrição: "${transcription}"\n\n${confidenceText} Classificado como: ${classificationText} (${Math.round(classification.confidence * 100)}% de confiança)`
      );
      
      // If low confidence, we could implement buttons here in the future
      if (classification.confidence < Config.getClassificationThreshold(context.env)) {
        await sendMessage(
          context,
          userPhone,
          '⚠️ Confiança baixa na classificação. Processando como ' + classificationText
        );
      }
    } catch (error) {
      console.error('Classification failed:', error);
      classification = { type: 'task', confidence: 0.5, reasoning: 'Classification failed, defaulting to task' };
    }
  } else {
    // Default to task if classification is disabled
    classification = { type: 'task', confidence: 1.0, reasoning: 'Classification disabled' };
  }
  
  // Process based on classification
  if (classification.type === 'note') {
    await processAsNote(transcription, payload, context, userPhone);
  } else if (classification.type.startsWith('fund_')) {
    await processAsFund(classification.type, transcription, payload, context, userPhone);
  } else {
    await processAsTask(transcription, payload, context, userPhone);
  }
}

async function processAsNote(
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext,
  userPhone: string
): Promise<void> {
  try {
    await sendMessage(
      context,
      userPhone,
      '📝 Salvando nota para sincronização com Obsidian...'
    );
    
    // Save to KV storage for voice sync
    const { EnhancedKVNoteStorage } = await import('@/modules/voice-sync');
    const kvStorage = new EnhancedKVNoteStorage(context.env.USER_CONFIGS);
    const noteId = await kvStorage.saveNote(transcription, userPhone, {
      audioUrl: payload.audio?.audioUrl,
      duration: payload.audio?.seconds || payload.audio?.duration,
      classification: 'note'
    });
    
    console.log('Note saved to KV:', {
      noteId,
      userId: userPhone,
      contentLength: transcription.length
    });
    
    await sendMessage(
      context,
      userPhone,
      `✅ Nota salva para sincronização!\n\n📝 "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"\n\n💡 A nota será sincronizada automaticamente com seu Obsidian.`
    );
  } catch (error) {
    console.error('Error saving note to KV:', error);
    await sendMessage(
      context,
      userPhone,
      '❌ Erro ao salvar nota. Criando tarefa no Todoist como fallback...'
    );
    await processAsTask(`[NOTA] ${transcription}`, payload, context, userPhone);
  }
}

async function processAsTask(
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext,
  userPhone: string
): Promise<void> {
  await sendMessage(
    context,
    userPhone,
    '✨ Criando tarefa no Todoist...'
  );
  
  if (!context.todoistToken) {
    await sendMessage(
      context,
      userPhone,
      '❌ Token do Todoist não configurado. Adicione TODOIST_API_TOKEN nas variáveis de ambiente.'
    );
    return;
  }
  
  try {
    // Parse task from transcription
    const parsedTask = await parseTaskFromTranscription(
      transcription,
      context.env.OPENAI_API_KEY
    );
    
    // Create Todoist client
    const todoistClient = new TodoistClient(context.todoistToken);
    
    // Create the task
    const createdTask = await todoistClient.createTask({
      content: parsedTask.content,
      due_string: parsedTask.due_string,
      priority: parsedTask.priority,
      labels: parsedTask.labels
    });
    
    let taskMessage = `✅ Tarefa criada no Todoist!\n\n📌 "${createdTask.content}"`;
    
    if (createdTask.due) {
      taskMessage += `\n📅 Prazo: ${createdTask.due.string}`;
    }
    
    if (parsedTask.priority && parsedTask.priority > 1) {
      const priorityEmojis = ['', '', '⚡', '🔥', '🚨'];
      taskMessage += `\n${priorityEmojis[parsedTask.priority]} Prioridade: ${
        parsedTask.priority === 4 ? 'Urgente' : 
        parsedTask.priority === 3 ? 'Alta' : 'Média'
      }`;
    }
    
    if (parsedTask.labels && parsedTask.labels.length > 0) {
      taskMessage += `\n🏷️ Etiquetas: ${parsedTask.labels.join(', ')}`;
    }
    
    await sendMessage(context, userPhone, taskMessage);
    
  } catch (error) {
    console.error('Error creating Todoist task:', error);
    await sendMessage(
      context,
      userPhone,
      '❌ Erro ao criar tarefa no Todoist. Verifique se o token está correto.'
    );
  }
}

async function processAsFund(
  fundType: string,
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext,
  userPhone: string
): Promise<void> {
  try {
    // Import AudioProcessor dynamically to avoid circular dependency
    const { AudioProcessor } = await import('@/router/AudioProcessor');
    const audioProcessor = new AudioProcessor(context.env);
    
    // Use the proper fund command processor
    await audioProcessor.processFundCommand(transcription, fundType, payload);
    
  } catch (error) {
    console.error('Error processing fund command:', error);
    
    // Fallback to creating a task
    await sendMessage(
      context,
      userPhone,
      '❌ Erro ao processar comando de fundo. Criando tarefa como fallback...'
    );
    
    let taskContent = '';
    
    switch (fundType) {
      case 'fund_add':
        taskContent = `[FUNDO-ADICIONAR] ${transcription}`;
        break;
      case 'fund_remove':
        taskContent = `[FUNDO-REMOVER] ${transcription}`;
        break;
      case 'fund_quote':
        taskContent = `[FUNDO-COTACAO] ${transcription}`;
        break;
      case 'fund_portfolio':
        taskContent = `[FUNDO-PORTFOLIO] ${transcription}`;
        break;
      case 'fund_update':
        taskContent = `[FUNDO-ATUALIZAR] ${transcription}`;
        break;
      default:
        taskContent = `[FUNDO] ${transcription}`;
    }
    
    await processAsTask(taskContent, payload, context, userPhone);
  }
}

// Helper function to send messages back through Z-API
async function sendMessage(context: AudioContext, to: string, message: string): Promise<void> {
  try {
    if (!context.env.Z_API_INSTANCE_ID || !context.env.Z_API_INSTANCE_TOKEN || 
        (!context.env.Z_API_SECURITY_TOKEN && !context.env.Z_API_CLIENT_TOKEN)) {
      console.error('Z-API credentials not configured');
      return;
    }
    
    const url = `https://api.z-api.io/instances/${context.env.Z_API_INSTANCE_ID}/token/${context.env.Z_API_INSTANCE_TOKEN}/send-text`;
    const body = {
      phone: to,
      message
    };
    
    console.log('Sending Z-API message:', {
      url,
      to,
      messageLength: message.length,
      hasClientToken: !!context.env.Z_API_SECURITY_TOKEN
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': context.env.Z_API_CLIENT_TOKEN || context.env.Z_API_SECURITY_TOKEN
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Z-API error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Z-API error: ${response.status} - ${errorText}`);
    }
    
    console.log('Z-API message sent successfully');
  } catch (error) {
    console.error('Error sending message via Z-API:', error);
  }
}