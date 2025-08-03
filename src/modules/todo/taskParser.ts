import { ParsedTaskFromAudio } from './types';
import { parsePriority, parseDueString } from './client';

export async function parseTaskFromTranscription(
  transcription: string,
  openaiApiKey: string
): Promise<ParsedTaskFromAudio> {
  // First, try simple parsing
  const simpleTask = simpleParseTask(transcription);
  
  // If OpenAI key is available, use AI for better parsing
  if (openaiApiKey) {
    try {
      return await aiParseTask(transcription, openaiApiKey);
    } catch (error) {
      console.error('AI parsing failed, falling back to simple parsing:', error);
      return simpleTask;
    }
  }
  
  return simpleTask;
}

function simpleParseTask(transcription: string): ParsedTaskFromAudio {
  // Remove common task-related prefixes
  const prefixes = ['tarefa', 'lembrete', 'lembrar de', 'preciso', 'fazer'];
  let content = transcription;
  
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}:?\\s*`, 'i');
    content = content.replace(regex, '');
  }
  
  return {
    content: content.trim(),
    due_string: parseDueString(transcription),
    priority: parsePriority(transcription),
    labels: extractLabels(transcription)
  };
}

async function aiParseTask(
  transcription: string,
  openaiApiKey: string
): Promise<ParsedTaskFromAudio> {
  const prompt = `Extract task information from this transcription. Return a JSON object with:
- content: the main task description (clean and concise)
- due_string: due date in Portuguese if mentioned (hoje, amanhã, próxima semana, etc)
- priority: 1-4 (1=normal, 4=urgent)
- labels: array of relevant labels

Transcription: "${transcription}"

Return only valid JSON, no markdown.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a task parser. Extract task information from transcriptions and return structured JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  const content = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    return {
      content: parsed.content || transcription,
      due_string: parsed.due_string,
      priority: parsed.priority || 1,
      labels: parsed.labels || []
    };
  } catch (error) {
    console.error('Failed to parse AI response:', content);
    return simpleParseTask(transcription);
  }
}

function extractLabels(text: string): string[] {
  const labels: string[] = [];
  
  // Common labels to detect
  const labelMap: Record<string, string[]> = {
    'trabalho': ['trabalho', 'job', 'office', 'escritório'],
    'pessoal': ['pessoal', 'personal', 'casa', 'home'],
    'compras': ['comprar', 'compras', 'shopping', 'mercado'],
    'saúde': ['médico', 'dentista', 'consulta', 'exame', 'saúde'],
    'financeiro': ['pagar', 'conta', 'boleto', 'banco', 'dinheiro']
  };
  
  const lowerText = text.toLowerCase();
  
  for (const [label, keywords] of Object.entries(labelMap)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      labels.push(label);
    }
  }
  
  return labels;
}