import { BaseDomainModule, ModuleHealth } from '@/core/modules/IDomainModule';
import { IMessagingService, MessageType } from '@/core/services/interfaces/IMessagingService';
import { IStorageService } from '@/core/services/interfaces/IStorageService';
import { IAIService } from '@/core/services/interfaces/IAIService';
import { ILogger } from '@/core/logging/Logger';
import { IErrorHandler } from '@/core/logging/ErrorHandler';
import { ServiceTokens } from '@/core/services/ServiceRegistry';
import {
  AudioReceivedEvent,
  AudioTranscribedEvent,
  AudioClassifiedEvent,
  TaskCreatedEvent,
  NoteCreatedEvent,
  MessageSentEvent,
} from '@/core/event-bus/EventTypes';
import { AudioHandler } from './handlers/AudioHandler';
import { ClassificationHandler } from './handlers/ClassificationHandler';
import { AudioProcessingConfig } from './types';

/**
 * Audio Processing Domain Module
 * Handles voice message transcription, classification, and routing
 */
export class AudioProcessingModule extends BaseDomainModule {
  private messagingService!: IMessagingService;
  private storageService!: IStorageService;
  private aiService!: IAIService;
  private logger!: ILogger;
  private errorHandler!: IErrorHandler;
  
  private audioHandler!: AudioHandler;
  private classificationHandler!: ClassificationHandler;
  
  private config: AudioProcessingConfig = {
    maxAudioSizeMB: 25,
    supportedFormats: ['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
    transcriptionLanguage: 'pt', // OpenAI requires ISO-639-1 format, not pt-BR
    classificationEnabled: true,
    classificationCategories: ['task', 'note', 'fund', 'question', 'other'],
    storageNamespace: 'audio-processing',
  };
  
  constructor() {
    super('AudioProcessingModule', '2.0.0', [
      ServiceTokens.MESSAGING,
      ServiceTokens.STORAGE,
      ServiceTokens.AI,
      ServiceTokens.LOGGER,
      ServiceTokens.ERROR_HANDLER,
    ]);
  }
  
  protected async onInitialize(): Promise<void> {
    // Resolve dependencies
    this.messagingService = this.container.resolve<IMessagingService>(ServiceTokens.MESSAGING);
    this.storageService = this.container.resolve<IStorageService>(ServiceTokens.STORAGE);
    this.aiService = this.container.resolve<IAIService>(ServiceTokens.AI);
    this.logger = this.container.resolve<ILogger>(ServiceTokens.LOGGER);
    this.errorHandler = this.container.resolve<IErrorHandler>(ServiceTokens.ERROR_HANDLER);
    
    // Create child logger
    this.logger = this.logger.child({ module: this.name });
    
    // Initialize handlers
    this.audioHandler = new AudioHandler(
      this.aiService,
      this.storageService,
      this.logger,
      this.config
    );
    
    this.classificationHandler = new ClassificationHandler(
      this.aiService,
      this.logger,
      this.config
    );
    
    this.logger.info('Audio Processing Module initialized');
  }
  
  protected subscribeToEvents(): void {
    // Subscribe to audio received events
    this.subscribe<AudioReceivedEvent>(
      'audio.received',
      this.handleAudioReceived.bind(this)
    );
  }
  
  private async handleAudioReceived(event: AudioReceivedEvent): Promise<void> {
    const { userId, audioData, mimeType, duration } = event.payload;
    
    try {
      this.logger.info('Processing audio message', {
        userId,
        mimeType,
        duration,
        eventId: event.id,
      });
      
      // Send immediate feedback like legacy implementation
      await this.sendMessage(userId, '🎤 Áudio recebido! Processando transcrição...');
      
      // Validate audio
      if (!this.validateAudio(audioData, mimeType)) {
        await this.sendErrorMessage(userId, 'Formato de áudio não suportado ou arquivo muito grande.');
        return;
      }
      
      // Transcribe audio
      let transcription;
      try {
        transcription = await this.audioHandler.transcribeAudio(audioData, {
          language: this.config.transcriptionLanguage,
        });
      } catch (transcriptionError) {
        this.logger.error('Transcription failed', transcriptionError);
        
        // Send user-friendly error message based on the error
        const errorMessage = transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error';
        if (errorMessage.includes('API key')) {
          await this.sendErrorMessage(userId, 'Bot não está configurado corretamente. Por favor, configure a chave da API OpenAI.');
        } else if (errorMessage.includes('timeout')) {
          await this.sendErrorMessage(userId, 'O processamento do áudio demorou muito. Por favor, tente com um áudio mais curto.');
        } else {
          await this.sendErrorMessage(userId, 'Não consegui transcrever o áudio. Por favor, tente novamente.');
        }
        return;
      }
      
      if (!transcription || transcription.text.trim().length === 0) {
        await this.sendErrorMessage(userId, 'Não consegui transcrever o áudio. Por favor, tente falar mais claramente.');
        return;
      }
      
      // Publish transcription event
      await this.publish(new AudioTranscribedEvent(
        {
          userId,
          transcription: transcription.text,
          language: transcription.language,
          confidence: transcription.confidence,
        },
        { correlationId: event.metadata.correlationId }
      ));
      
      // Classify if enabled
      if (this.config.classificationEnabled) {
        await this.classifyAndRoute(userId, transcription.text, event.metadata.correlationId);
      } else {
        // Default to task creation
        await this.createTask(userId, transcription.text, event.metadata.correlationId);
      }
      
    } catch (error) {
      this.errorHandler.handle(error, {
        module: this.name,
        operation: 'handleAudioReceived',
        userId,
        correlationId: event.metadata.correlationId,
      });
      
      await this.sendErrorMessage(userId, 'Erro ao processar o áudio. Por favor, tente novamente.');
    }
  }
  
  private async classifyAndRoute(userId: string, text: string, correlationId?: string): Promise<void> {
    try {
      const classification = await this.classificationHandler.classify(text);
      
      // Publish classification event
      await this.publish(new AudioClassifiedEvent(
        {
          userId,
          transcription: text,
          classification: classification.category,
          confidence: classification.confidence,
        },
        { correlationId }
      ));
      
      // Route based on classification
      switch (classification.category) {
        case 'task':
          await this.createTask(userId, text, correlationId);
          break;
          
        case 'note':
          await this.createNote(userId, text, correlationId);
          break;
          
        case 'fund':
          await this.handleFundCommand(userId, text, correlationId);
          break;
          
        case 'question':
          await this.handleQuestion(userId, text, correlationId);
          break;
          
        default:
          await this.sendMessage(userId, `Entendi: "${text}"\n\nNão consegui identificar o que fazer com esta mensagem.`);
      }
      
    } catch (error) {
      this.logger.error('Classification failed, defaulting to task', error);
      await this.createTask(userId, text, correlationId);
    }
  }
  
  private async createTask(userId: string, text: string, correlationId?: string): Promise<void> {
    try {
      // Parse task details from text
      const taskData = this.parseTaskFromText(text);
      
      // Get Todoist API token from environment
      const todoistToken = (this.container.resolve('IEnvironment') as any).TODOIST_API_TOKEN;
      
      if (todoistToken && todoistToken !== 'undefined') {
        // Create task in Todoist using the legacy client
        const { TodoistClient } = await import('../../legacy/modules/todo/client');
        const todoistClient = new TodoistClient(todoistToken);
        
        const todoistTask = {
          content: taskData.title,
          description: taskData.description || '',
          due_string: taskData.dueDate ? taskData.dueDate.toISOString().split('T')[0] : undefined,
          priority: taskData.priority || 1,
        };
        
        try {
          const createdTask = await todoistClient.createTask(todoistTask);
          
          // Store task in local storage with Todoist ID
          const taskId = `task_${createdTask.id}`;
          await this.storageService.put(
            this.config.storageNamespace,
            taskId,
            {
              userId,
              text,
              taskData,
              todoistId: createdTask.id,
              timestamp: new Date(),
            }
          );
          
          // Send success confirmation
          await this.sendMessage(
            userId,
            `✅ Tarefa criada no Todoist: "${taskData.title}"\n${taskData.dueDate ? `📅 Data: ${taskData.dueDate.toLocaleDateString('pt-BR')}` : ''}`
          );
          
          // Publish task created event
          await this.publish(new TaskCreatedEvent(
            {
              userId,
              taskId: createdTask.id,
              title: taskData.title,
              description: taskData.description,
              dueDate: taskData.dueDate,
              project: taskData.project,
            },
            { correlationId }
          ));
        } catch (todoistError) {
          this.logger.error('Failed to create task in Todoist', todoistError);
          await this.sendErrorMessage(userId, 'Erro ao criar tarefa no Todoist. Verifique se o token está correto.');
        }
      } else {
        // No Todoist token configured, just store locally
        this.logger.warn('Todoist token not configured, storing task locally');
        
        // Store task in local storage
        const taskId = `task_${Date.now()}`;
        await this.storageService.put(
          this.config.storageNamespace,
          taskId,
          {
            userId,
            text,
            taskData,
            timestamp: new Date(),
          }
        );
        
        // Send confirmation (indicating it's stored locally)
        await this.sendMessage(
          userId,
          `📝 Tarefa salva localmente (Todoist não configurado): "${taskData.title}"\n${taskData.dueDate ? `📅 Data: ${taskData.dueDate.toLocaleDateString('pt-BR')}` : ''}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to create task', error);
      await this.sendErrorMessage(userId, 'Erro ao criar tarefa. Por favor, tente novamente.');
    }
  }
  
  private async createNote(userId: string, text: string, correlationId?: string): Promise<void> {
    const noteId = `note_${Date.now()}`;
    
    // Store note
    await this.storageService.put(
      this.config.storageNamespace,
      noteId,
      {
        userId,
        content: text,
        timestamp: new Date(),
      }
    );
    
    // Publish note created event
    await this.publish(new NoteCreatedEvent(
      {
        userId,
        noteId,
        content: text,
        tags: this.extractTags(text),
      },
      { correlationId }
    ));
    
    // Send confirmation
    await this.sendMessage(userId, `📝 Nota salva: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  }
  
  private async handleFundCommand(userId: string, text: string, _correlationId?: string): Promise<void> {
    // This would be handled by the Fund module via events
    await this.sendMessage(userId, `💰 Comando de fundo recebido. Processando: "${text}"`);
  }
  
  private async handleQuestion(userId: string, text: string, _correlationId?: string): Promise<void> {
    try {
      // Generate AI response
      const response = await this.aiService.generateCompletion(text, {
        systemPrompt: 'Você é um assistente útil que responde perguntas em português brasileiro de forma concisa.',
        maxTokens: 500,
      });
      
      await this.sendMessage(userId, `💡 ${response.text}`);
    } catch (error) {
      this.logger.error('Failed to generate response', error);
      await this.sendMessage(userId, 'Desculpe, não consegui processar sua pergunta no momento.');
    }
  }
  
  private async sendMessage(userId: string, content: string): Promise<void> {
    try {
      const result = await this.messagingService.sendMessage({
        recipient: userId,
        content,
        type: MessageType.TEXT,
      });
      
      // Publish message sent event
      await this.publish(new MessageSentEvent({
        recipient: userId,
        messageType: 'text',
        content,
        success: result.success,
        messageId: result.messageId,
      }));
      
    } catch (error) {
      this.logger.error('Failed to send message', error, { userId });
    }
  }
  
  private async sendErrorMessage(userId: string, message: string): Promise<void> {
    await this.sendMessage(userId, `❌ ${message}`);
  }
  
  private validateAudio(audioData: ArrayBuffer | string, mimeType: string): boolean {
    // Extract base mime type (remove parameters like "; codecs=opus")
    const baseMimeType = mimeType.split(';')[0].trim();
    
    // Check format
    if (!this.config.supportedFormats.includes(baseMimeType)) {
      this.logger.warn('Unsupported audio format', { 
        mimeType, 
        baseMimeType, 
        supportedFormats: this.config.supportedFormats 
      });
      return false;
    }
    
    // Check size
    const sizeInBytes = typeof audioData === 'string' 
      ? Buffer.from(audioData, 'base64').byteLength 
      : audioData.byteLength;
    
    const sizeInMB = sizeInBytes / (1024 * 1024);
    if (sizeInMB > this.config.maxAudioSizeMB) {
      this.logger.warn('Audio file too large', { 
        sizeInMB, 
        maxSizeMB: this.config.maxAudioSizeMB 
      });
      return false;
    }
    
    return true;
  }
  
  private parseTaskFromText(text: string): any {
    // Simple task parsing logic
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dueDate: Date | undefined;
    let project: string | undefined;
    
    // Check for date keywords
    if (text.includes('amanhã')) {
      dueDate = tomorrow;
    } else if (text.includes('hoje')) {
      dueDate = new Date();
    }
    
    // Check for project tags
    const projectMatch = text.match(/#(\w+)/);
    if (projectMatch) {
      project = projectMatch[1];
    }
    
    // Clean title
    let title = text
      .replace(/amanhã|hoje/gi, '')
      .replace(/#\w+/g, '')
      .trim();
    
    return {
      title: title || text,
      description: '',
      dueDate,
      project,
    };
  }
  
  private extractTags(text: string): string[] {
    const tagMatches = text.match(/#\w+/g);
    return tagMatches ? tagMatches.map(tag => tag.substring(1)) : [];
  }
  
  protected async onStart(): Promise<void> {
    this.logger.info('Audio Processing Module started');
  }
  
  protected async onStop(): Promise<void> {
    this.logger.info('Audio Processing Module stopped');
  }
  
  protected async onDispose(): Promise<void> {
    this.logger.info('Audio Processing Module disposed');
  }
  
  protected async onHealthCheck(): Promise<Partial<ModuleHealth>> {
    const metrics = {
      processedCount: await this.getProcessedCount(),
      lastProcessed: await this.getLastProcessedTime(),
    };
    
    return {
      metrics,
      healthy: true,
    };
  }
  
  private async getProcessedCount(): Promise<number> {
    // Get count from storage
    const count = await this.storageService.get<number>(
      this.config.storageNamespace,
      'processed_count'
    );
    return count || 0;
  }
  
  private async getLastProcessedTime(): Promise<string | null> {
    const time = await this.storageService.get<string>(
      this.config.storageNamespace,
      'last_processed'
    );
    return time;
  }
}