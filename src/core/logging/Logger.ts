/**
 * Structured logging service
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  correlationId?: string;
  source?: string;
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  fatal(message: string, error?: Error | unknown, context?: LogContext): void;
  child(context: LogContext): ILogger;
  setCorrelationId(id: string): void;
}

export interface LoggerConfig {
  level?: string;
  format?: 'json' | 'text';
  prefix?: string;
  enableConsole?: boolean;
  enableBuffer?: boolean;
  bufferSize?: number;
}

export class Logger implements ILogger {
  private level: LogLevel;
  private format: 'json' | 'text';
  private prefix: string;
  private enableConsole: boolean;
  private enableBuffer: boolean;
  private buffer: LogEntry[] = [];
  private bufferSize: number;
  private defaultContext: LogContext = {};
  private correlationId?: string;
  
  constructor(config: LoggerConfig = {}) {
    this.level = this.parseLevel(config.level || 'info');
    this.format = config.format || 'json';
    this.prefix = config.prefix || '';
    this.enableConsole = config.enableConsole !== false;
    this.enableBuffer = config.enableBuffer || false;
    this.bufferSize = config.bufferSize || 100;
  }
  
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = this.normalizeError(error);
    this.log(LogLevel.ERROR, message, context, errorObj);
  }
  
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = this.normalizeError(error);
    this.log(LogLevel.FATAL, message, context, errorObj);
  }
  
  child(context: LogContext): ILogger {
    const childLogger = new Logger({
      level: LogLevel[this.level].toLowerCase(),
      format: this.format,
      prefix: this.prefix,
      enableConsole: this.enableConsole,
      enableBuffer: this.enableBuffer,
      bufferSize: this.bufferSize,
    });
    
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    childLogger.correlationId = this.correlationId;
    
    return childLogger;
  }
  
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }
  
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }
  
  clearBuffer(): void {
    this.buffer = [];
  }
  
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (level < this.level) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: this.prefix ? `${this.prefix} ${message}` : message,
      context: { ...this.defaultContext, ...context },
      error,
      correlationId: this.correlationId,
      source: this.getSource(),
    };
    
    if (this.enableBuffer) {
      this.addToBuffer(entry);
    }
    
    if (this.enableConsole) {
      this.writeToConsole(entry);
    }
  }
  
  private writeToConsole(entry: LogEntry): void {
    const output = this.format === 'json' 
      ? this.formatJson(entry)
      : this.formatText(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(output);
        break;
    }
  }
  
  private formatJson(entry: LogEntry): string {
    const output: any = {
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
    };
    
    if (entry.correlationId) {
      output.correlationId = entry.correlationId;
    }
    
    if (entry.source) {
      output.source = entry.source;
    }
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      output.context = entry.context;
    }
    
    if (entry.error) {
      output.error = {
        message: entry.error.message,
        stack: entry.error.stack,
        name: entry.error.name,
      };
    }
    
    return JSON.stringify(output);
  }
  
  private formatText(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const correlationId = entry.correlationId ? `[${entry.correlationId}] ` : '';
    const source = entry.source ? `[${entry.source}] ` : '';
    
    let output = `${timestamp} ${level} ${correlationId}${source}${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    return output;
  }
  
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }
  
  private parseLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'fatal':
        return LogLevel.FATAL;
      default:
        return LogLevel.INFO;
    }
  }
  
  private normalizeError(error: Error | unknown): Error | undefined {
    if (!error) {
      return undefined;
    }
    
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (typeof error === 'object' && error !== null) {
      const err = new Error(JSON.stringify(error));
      err.name = 'UnknownError';
      return err;
    }
    
    return new Error(String(error));
  }
  
  private getSource(): string | undefined {
    // Try to extract the calling function/module from stack trace
    const stack = new Error().stack;
    if (!stack) return undefined;
    
    const lines = stack.split('\n');
    // Skip first 3 lines (Error message, this function, log function)
    const callerLine = lines[3];
    if (!callerLine) return undefined;
    
    // Extract file name and line number
    const match = callerLine.match(/at\s+(?:.*?\s+\()?(.+?):(\d+):(\d+)/);
    if (match) {
      const file = match[1].split('/').pop();
      return `${file}:${match[2]}`;
    }
    
    return undefined;
  }
}