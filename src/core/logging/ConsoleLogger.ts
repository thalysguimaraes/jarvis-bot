import { Injectable } from '../decorators/Injectable';
import { ILogger, LogLevel, LogContext } from './Logger';

/**
 * Simple console logger implementation for development and testing
 */
@Injectable({ singleton: true })
export class ConsoleLogger implements ILogger {
  private context: LogContext = {};
  private correlationId?: string;
  
  constructor(
    private level: LogLevel = LogLevel.INFO,
    defaultContext?: LogContext
  ) {
    if (defaultContext) {
      this.context = { ...defaultContext };
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }
  
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const ctx = { 
      ...this.context, 
      ...context,
      ...(this.correlationId && { correlationId: this.correlationId })
    };
    const contextStr = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : '';
    return `[${timestamp}] [${levelName}] ${message}${contextStr}`;
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }
  
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }
  
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorInfo = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
      const fullContext = { ...context, ...errorInfo };
      console.error(this.formatMessage(LogLevel.ERROR, message, fullContext));
    }
  }
  
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      const errorInfo = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
      const fullContext = { ...context, ...errorInfo };
      console.error(this.formatMessage(LogLevel.FATAL, message, fullContext));
    }
  }
  
  child(context: LogContext): ILogger {
    return new ConsoleLogger(this.level, { ...this.context, ...context });
  }
  
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  getLevel(): LogLevel {
    return this.level;
  }
}