import { vi } from 'vitest';

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface ClassificationResult {
  type: 'task' | 'note' | 'fund' | 'other';
  confidence: number;
  metadata?: any;
}

export class MockAIService {
  private transcriptionResponses = new Map<string, string>();
  private classificationResponses = new Map<string, ClassificationResult>();
  private shouldFail = false;
  private delay = 0;
  
  // Mock methods
  transcribeAudio = vi.fn(async (audioData: string): Promise<TranscriptionResult> => {
    if (this.shouldFail) {
      throw new Error('AI service temporarily unavailable');
    }
    
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    
    const response = this.transcriptionResponses.get(audioData);
    if (response) {
      return { text: response, language: 'pt-BR' };
    }
    
    // Default response
    return { 
      text: 'Mock transcription: test audio content',
      language: 'pt-BR',
      duration: 5.2,
    };
  });
  
  classifyText = vi.fn(async (text: string): Promise<ClassificationResult> => {
    if (this.shouldFail) {
      throw new Error('Classification service unavailable');
    }
    
    const response = this.classificationResponses.get(text);
    if (response) {
      return response;
    }
    
    // Default classification based on keywords
    if (text.toLowerCase().includes('task') || text.toLowerCase().includes('tarefa')) {
      return { type: 'task', confidence: 0.9 };
    }
    if (text.toLowerCase().includes('note') || text.toLowerCase().includes('nota')) {
      return { type: 'note', confidence: 0.85 };
    }
    if (text.toLowerCase().includes('fund') || text.toLowerCase().includes('fundo')) {
      return { type: 'fund', confidence: 0.88 };
    }
    
    return { type: 'other', confidence: 0.5 };
  });
  
  generateCompletion = vi.fn(async (prompt: string): Promise<string> => {
    if (this.shouldFail) {
      throw new Error('Completion service unavailable');
    }
    
    return `Generated response for: ${prompt.substring(0, 50)}...`;
  });
  
  // Test helpers
  setTranscriptionResponse(audioData: string, text: string): void {
    this.transcriptionResponses.set(audioData, text);
  }
  
  setClassificationResponse(text: string, result: ClassificationResult): void {
    this.classificationResponses.set(text, result);
  }
  
  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }
  
  setDelay(ms: number): void {
    this.delay = ms;
  }
  
  clearResponses(): void {
    this.transcriptionResponses.clear();
    this.classificationResponses.clear();
  }
  
  getCallHistory() {
    return {
      transcriptions: this.transcribeAudio.mock.calls,
      classifications: this.classifyText.mock.calls,
      completions: this.generateCompletion.mock.calls,
    };
  }
}