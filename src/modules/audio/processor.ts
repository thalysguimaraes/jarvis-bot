import { BaileysWebhookPayload } from '@/services/whatsapp/types';
import { TodoistClient } from '@/modules/todo/client';
import { parseTaskFromTranscription } from '@/modules/todo/taskParser';

interface AudioContext {
  env: any;
  userId: string;
  todoistToken?: string;
  baileysPayload: BaileysWebhookPayload;
}

export async function processAudioMessage(
  payload: BaileysWebhookPayload,
  context: AudioContext
): Promise<void> {
  try {
    if (!payload.audio) {
      throw new Error('No audio data in payload');
    }
    
    // Decode base64 audio data
    const audioBuffer = Buffer.from(payload.audio.data, 'base64');
    
    // Convert to blob for OpenAI
    const audioBlob = new Blob([audioBuffer], { type: payload.audio.mimetype });
    
    // Transcribe with OpenAI Whisper
    const transcription = await transcribeAudio(audioBlob, context.env);
    
    if (!transcription || transcription.trim().length === 0) {
      await sendMessage(
        context,
        payload.from,
        '❌ Não consegui transcrever o áudio. Por favor, tente falar mais claramente.'
      );
      return;
    }
    
    // Process the transcribed text
    await processTranscription(transcription, payload, context);
    
  } catch (error) {
    console.error('Audio processing error:', error);
    throw error;
  }
}

async function transcribeAudio(audioBlob: Blob, env: any): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const result = await response.json() as { text: string };
  return result.text;
}

async function processTranscription(
  transcription: string,
  payload: BaileysWebhookPayload,
  context: AudioContext
): Promise<void> {
  await sendMessage(
    context,
    payload.from,
    `📝 Transcrição: "${transcription}"\n\n✨ Criando tarefa no Todoist...`
  );
  
  if (!context.todoistToken) {
    await sendMessage(
      context,
      payload.from,
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
    
    await sendMessage(context, payload.from, taskMessage);
    
  } catch (error) {
    console.error('Error creating Todoist task:', error);
    await sendMessage(
      context,
      payload.from,
      '❌ Erro ao criar tarefa no Todoist. Verifique se o token está correto.'
    );
  }
}

// Helper function to send messages back through Baileys
async function sendMessage(context: AudioContext, to: string, message: string): Promise<void> {
  try {
    await fetch(`${context.env.BAILEYS_SERVICE_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        to,
        message,
        type: 'text'
      })
    });
  } catch (error) {
    console.error('Error sending message to Baileys:', error);
  }
}