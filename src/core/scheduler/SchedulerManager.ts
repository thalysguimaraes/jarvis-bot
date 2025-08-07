import { IEventBus } from '../event-bus/EventBus';
import { DomainEvent } from '../event-bus/DomainEvent';
import { ILogger } from '../logging/Logger';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  eventType: string;
  payload?: any;
  enabled: boolean;
}

export interface ISchedulerManager {
  registerTask(task: ScheduledTask): void;
  unregisterTask(taskId: string): void;
  enableTask(taskId: string): void;
  disableTask(taskId: string): void;
  handleScheduledEvent(event: ScheduledEvent): Promise<void>;
  getTasks(): ScheduledTask[];
}

export class SchedulerManager implements ISchedulerManager {
  private tasks = new Map<string, ScheduledTask>();
  
  constructor(
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}

  registerTask(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      this.logger.warn('Task already registered, updating', { taskId: task.id });
    }
    
    this.tasks.set(task.id, task);
    this.logger.info('Scheduled task registered', { 
      taskId: task.id, 
      name: task.name,
      cron: task.cronExpression 
    });
  }

  unregisterTask(taskId: string): void {
    if (this.tasks.delete(taskId)) {
      this.logger.info('Scheduled task unregistered', { taskId });
    } else {
      this.logger.warn('Task not found for unregistration', { taskId });
    }
  }

  enableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = true;
      this.logger.info('Scheduled task enabled', { taskId });
    } else {
      this.logger.warn('Task not found for enabling', { taskId });
    }
  }

  disableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = false;
      this.logger.info('Scheduled task disabled', { taskId });
    } else {
      this.logger.warn('Task not found for disabling', { taskId });
    }
  }

  async handleScheduledEvent(event: ScheduledEvent): Promise<void> {
    const { cron } = event;
    
    this.logger.debug('Handling scheduled event', { cron, time: new Date().toISOString() });
    
    // Find all tasks matching this cron expression
    const matchingTasks = Array.from(this.tasks.values()).filter(
      task => task.enabled && this.matchesCron(task.cronExpression, cron)
    );
    
    if (matchingTasks.length === 0) {
      this.logger.debug('No matching tasks for cron', { cron });
      return;
    }
    
    // Execute all matching tasks
    for (const task of matchingTasks) {
      try {
        this.logger.info('Executing scheduled task', { 
          taskId: task.id, 
          name: task.name 
        });
        
        // Publish the task's event
        const event = new DomainEvent(
          task.eventType,
          task.payload || {},
          {
            source: 'scheduler',
            correlationId: `sched_${Date.now()}_${task.id}`
          }
        );
        
        await this.eventBus.publish(event);
        
        this.logger.info('Scheduled task executed successfully', { 
          taskId: task.id 
        });
      } catch (error) {
        this.logger.error('Failed to execute scheduled task', error as Error, { 
          taskId: task.id,
          name: task.name 
        });
      }
    }
  }

  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  private matchesCron(taskCron: string, eventCron: string): boolean {
    // Simple matching for now - in production, use a proper cron parser
    // This assumes the Worker sends the exact cron expression
    return taskCron === eventCron;
  }
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: Date;
  actualTime: Date;
}

/**
 * Default scheduled tasks for the application
 */
export function getDefaultScheduledTasks(): ScheduledTask[] {
  return [
    {
      id: 'daily-portfolio-report',
      name: 'Daily Portfolio Report',
      cronExpression: '0 9 * * *', // 9 AM daily
      eventType: 'scheduler.daily_portfolio_report',
      payload: { reportType: 'daily' },
      enabled: true
    },
    {
      id: 'weekly-portfolio-summary',
      name: 'Weekly Portfolio Summary',
      cronExpression: '0 10 * * 1', // 10 AM every Monday
      eventType: 'scheduler.weekly_portfolio_summary',
      payload: { reportType: 'weekly' },
      enabled: false // Disabled by default
    }
  ];
}