import { IAIService, ClassificationResult } from '@/core/services/interfaces/IAIService';
import { ILogger } from '@/core/logging/Logger';
import { AudioProcessingConfig } from '../types';

/**
 * Handles text classification for routing
 */
export class ClassificationHandler {
  constructor(
    private aiService: IAIService,
    private logger: ILogger,
    private config: AudioProcessingConfig
  ) {}
  
  async classify(text: string): Promise<ClassificationResult> {
    try {
      // First try keyword-based classification for speed
      const keywordResult = this.classifyByKeywords(text);
      if (keywordResult.confidence > 0.8) {
        this.logger.debug('Used keyword classification', keywordResult);
        return keywordResult;
      }
      
      // Use AI classification for ambiguous cases
      const aiResult = await this.aiService.classifyText(text, {
        categories: this.config.classificationCategories,
        threshold: 0.6,
      });
      
      this.logger.debug('Used AI classification', aiResult);
      return aiResult;
      
    } catch (error) {
      this.logger.error('Classification failed', error);
      // Default to 'other' category
      return {
        category: 'other',
        confidence: 0.5,
        reasoning: 'Classification failed, using default',
      };
    }
  }
  
  private classifyByKeywords(text: string): ClassificationResult {
    const lowerText = text.toLowerCase();
    
    // Task keywords
    const taskKeywords = [
      'tarefa', 'fazer', 'lembrar', 'amanhã', 'hoje', 'semana',
      'prazo', 'deadline', 'reunião', 'meeting', 'agendar',
      'comprar', 'pagar', 'enviar', 'ligar', 'avisar',
    ];
    
    // Note keywords
    const noteKeywords = [
      'nota', 'anotar', 'lembrete', 'ideia', 'pensamento',
      'observação', 'importante', 'guardar', 'salvar',
    ];
    
    // Question keywords
    const questionKeywords = [
      'o que', 'qual', 'quando', 'onde', 'como', 'por que',
      'quanto', 'quem', '?',
    ];
    
    // Count matches
    const taskMatches = taskKeywords.filter(kw => lowerText.includes(kw)).length;
    const noteMatches = noteKeywords.filter(kw => lowerText.includes(kw)).length;
    const questionMatches = questionKeywords.filter(kw => lowerText.includes(kw)).length;
    
    // Determine category based on highest match count
    const scores = [
      { category: 'task', count: taskMatches },
      { category: 'note', count: noteMatches },
      { category: 'question', count: questionMatches },
    ];
    
    scores.sort((a, b) => b.count - a.count);
    
    if (scores[0].count === 0) {
      return {
        category: 'other',
        confidence: 0.3,
        reasoning: 'No keywords matched',
      };
    }
    
    // Calculate confidence based on match strength
    const confidence = Math.min(0.6 + (scores[0].count * 0.1), 0.95);
    
    return {
      category: scores[0].category,
      confidence,
      reasoning: `Matched ${scores[0].count} keywords`,
    };
  }
}