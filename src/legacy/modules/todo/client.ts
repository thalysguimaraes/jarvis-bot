import { 
  TodoistTask, 
  TodoistTaskResponse, 
  TodoistProject, 
  TodoistLabel,
  TodoistError 
} from './types';

export class TodoistClient {
  private apiKey: string;
  private baseUrl = 'https://api.todoist.com/rest/v2';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    const headers: any = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      let error: TodoistError;
      try {
        error = (await response.json()) as any;
      } catch (e) {
        throw new Error(`Todoist API error: ${response.status} ${response.statusText}`);
      }
      throw new Error(error.error || `Todoist API error: ${response.status}`);
    }
    
    // DELETE requests return empty response
    if (method === 'DELETE') {
      return {} as T;
    }
    
    return await response.json() as T;
  }
  
  async createTask(task: TodoistTask): Promise<TodoistTaskResponse> {
    return await this.request<TodoistTaskResponse>('tasks', 'POST', task);
  }
  
  async getTasks(filter?: string): Promise<TodoistTaskResponse[]> {
    const params = new URLSearchParams();
    if (filter) {
      params.append('filter', filter);
    }
    
    const endpoint = params.toString() ? `tasks?${params.toString()}` : 'tasks';
    return await this.request<TodoistTaskResponse[]>(endpoint);
  }
  
  async getTask(taskId: string): Promise<TodoistTaskResponse> {
    return await this.request<TodoistTaskResponse>(`tasks/${taskId}`);
  }
  
  async updateTask(taskId: string, updates: Partial<TodoistTask>): Promise<TodoistTaskResponse> {
    return await this.request<TodoistTaskResponse>(`tasks/${taskId}`, 'POST', updates);
  }
  
  async closeTask(taskId: string): Promise<void> {
    await this.request(`tasks/${taskId}/close`, 'POST');
  }
  
  async reopenTask(taskId: string): Promise<void> {
    await this.request(`tasks/${taskId}/reopen`, 'POST');
  }
  
  async deleteTask(taskId: string): Promise<void> {
    await this.request(`tasks/${taskId}`, 'DELETE');
  }
  
  async getProjects(): Promise<TodoistProject[]> {
    return await this.request<TodoistProject[]>('projects');
  }
  
  async getLabels(): Promise<TodoistLabel[]> {
    return await this.request<TodoistLabel[]>('labels');
  }
  
  async testConnection(): Promise<boolean> {
    try {
      await this.getProjects();
      return true;
    } catch (error) {
      console.error('Todoist connection test failed:', error);
      return false;
    }
  }
}

export function formatDueDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parsePriority(text: string): number {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('urgente') || lowerText.includes('urgent')) {
    return 4;
  } else if (lowerText.includes('muito importante') || lowerText.includes('alta prioridade')) {
    return 3;
  } else if (lowerText.includes('importante') || lowerText.includes('prioridade')) {
    return 2;
  }
  
  return 1; // normal priority
}

export function parseDueString(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('hoje') || lowerText.includes('today')) {
    return 'hoje';
  } else if (lowerText.includes('amanhã') || lowerText.includes('tomorrow')) {
    return 'amanhã';
  } else if (lowerText.includes('semana que vem') || lowerText.includes('próxima semana')) {
    return 'próxima semana';
  } else if (lowerText.includes('próximo mês') || lowerText.includes('mês que vem')) {
    return 'próximo mês';
  }
  
  // Try to find date patterns
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch) {
    const [_, day, month] = dateMatch;
    return `${day}/${month}`;
  }
  
  return undefined;
}