import { ZApiWebhookPayload } from '@/services/whatsapp/types';
import { TodoistClient } from '@/modules/todo/client';
import { parseTaskFromTranscription } from '@/modules/todo/taskParser';
import { TranscriptionClassifier, ClassificationResult } from '@/modules/classification';
import { KVNoteStorage } from '@/modules/kv-notes';
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
  try {
    if (!payload.audio) {
      throw new Error('No audio data in payload');
    }
    
    // Download audio from Z-API URL
    const audioResponse = await fetch(payload.audio.audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    
    console.log('Audio info:', {
      originalMimeType: payload.audio.mimeType,
      bufferSize: audioBuffer.byteLength,
      bufferSizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
      duration: payload.audio.seconds
    });
    
    // Convert to blob for OpenAI
    const audioMimeType = payload.audio.mimeType || 'audio/ogg';
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
        payload.phone,
        '❌ Não consegui transcrever o áudio. Por favor, tente falar mais claramente.'
      );
      return;
    }
    
    // Classify and process the transcribed text
    await classifyAndProcess(transcription, payload, context);
    
  } catch (error) {
    console.error('Audio processing error:', error);
    throw error;
  }
}

async function transcribeAudio(audioBlob: Blob, env: any): Promise<string> {
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
    mimeType: audioBlob.type
  });
  
  formData.append('file', audioBlob, fileName);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');
  
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', {
        status: response.status,
        error
      });
      throw new Error(`OpenAI API error: ${error}`);
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
  context: AudioContext
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
        userId: payload.phone,
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
        payload.phone,
        `${classificationEmoji} Transcrição: "${transcription}"\n\n${confidenceText} Classificado como: ${classificationText} (${Math.round(classification.confidence * 100)}% de confiança)`
      );
      
      // If low confidence, we could implement buttons here in the future
      if (classification.confidence < Config.getClassificationThreshold(context.env)) {
        await sendMessage(
          context,
          payload.phone,
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
    await processAsNote(transcription, payload, context);
  } else if (classification.type.startsWith('fund_')) {
    await processAsFund(classification.type, transcription, payload, context);
  } else {
    await processAsTask(transcription, payload, context);
  }
}

async function processAsNote(
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext
): Promise<void> {
  try {
    await sendMessage(
      context,
      payload.phone,
      '📝 Salvando nota para sincronização com Obsidian...'
    );
    
    // Save to KV storage
    const kvStorage = new KVNoteStorage(context.env.USER_CONFIGS);
    const noteId = await kvStorage.saveNote(transcription, payload.phone);
    
    console.log('Note saved to KV:', {
      noteId,
      userId: payload.phone,
      contentLength: transcription.length
    });
    
    await sendMessage(
      context,
      payload.phone,
      `✅ Nota salva para sincronização!\n\n📝 "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"\n\n💡 A nota será sincronizada automaticamente com seu Obsidian.`
    );
  } catch (error) {
    console.error('Error saving note to KV:', error);
    await sendMessage(
      context,
      payload.phone,
      '❌ Erro ao salvar nota. Criando tarefa no Todoist como fallback...'
    );
    await processAsTask(`[NOTA] ${transcription}`, payload, context);
  }
}

async function processAsTask(
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext
): Promise<void> {
  await sendMessage(
    context,
    payload.phone,
    '✨ Criando tarefa no Todoist...'
  );
  
  if (!context.todoistToken) {
    await sendMessage(
      context,
      payload.phone,
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
    
    await sendMessage(context, payload.phone, taskMessage);
    
  } catch (error) {
    console.error('Error creating Todoist task:', error);
    await sendMessage(
      context,
      payload.phone,
      '❌ Erro ao criar tarefa no Todoist. Verifique se o token está correto.'
    );
  }
}

async function processAsFund(
  fundType: string,
  transcription: string,
  payload: ZApiWebhookPayload,
  context: AudioContext
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
      payload.phone,
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
    
    await processAsTask(taskContent, payload, context);
  }
}

// Helper function to send messages back through Z-API
async function sendMessage(context: AudioContext, to: string, message: string): Promise<void> {
  try {
    if (!context.env.Z_API_INSTANCE_ID || !context.env.Z_API_INSTANCE_TOKEN || !context.env.Z_API_SECURITY_TOKEN) {
      console.error('Z-API credentials not configured');
      return;
    }
    
    const response = await fetch(`https://api.z-api.io/instances/${context.env.Z_API_INSTANCE_ID}/token/${context.env.Z_API_INSTANCE_TOKEN}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': context.env.Z_API_SECURITY_TOKEN
      },
      body: JSON.stringify({
        phone: to,
        message
      })
    });
    
    if (!response.ok) {
      throw new Error(`Z-API error: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending message via Z-API:', error);
  }
}