import { Injectable } from '../../decorators/Injectable';
import { Inject } from '../../decorators/Inject';
import { ILogger } from '../../logging/Logger';
import { IConfigService } from '../../config/ConfigService';
import { EventBus } from '../../event-bus/EventBus';
import { IHealthCheckable, HealthCheckResult, HealthStatus } from '../interfaces/IHealthCheckable';
import { ResilienceManager } from '../resilience/ResilienceManager';

export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  enableAutoRecovery: boolean;
  criticalServices: string[];
  webhookUrl?: string;
}

export interface SystemHealthReport {
  status: HealthStatus;
  timestamp: Date;
  services: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  criticalServicesHealthy: boolean;
}

@Injectable({ singleton: true })
export class HealthCheckService {
  private services = new Map<string, IHealthCheckable>();
  private lastHealthCheck?: SystemHealthReport;
  private checkInterval?: NodeJS.Timeout;
  private config: HealthCheckConfig;
  private healthHistory: SystemHealthReport[] = [];
  private readonly maxHistorySize = 100;

  constructor(
    @Inject('ILogger') private logger: ILogger,
    @Inject('IConfigService') private configService: IConfigService,
    @Inject('IEventBus') private eventBus: EventBus,
    @Inject(ResilienceManager) private resilienceManager: ResilienceManager
  ) {
    this.config = this.loadConfig();
    this.setupEventListeners();
  }

  private loadConfig(): HealthCheckConfig {
    const healthConfig = this.configService.get<any>('health');
    
    return {
      intervalMs: healthConfig?.intervalMs || 60000, // 1 minute default
      timeoutMs: healthConfig?.timeoutMs || 5000,
      enableAutoRecovery: healthConfig?.enableAutoRecovery !== false,
      criticalServices: healthConfig?.criticalServices || [],
      webhookUrl: healthConfig?.webhookUrl
    };
  }

  private setupEventListeners(): void {
    this.eventBus.subscribe('service:unhealthy', async (event: any) => {
      if (this.config.enableAutoRecovery) {
        await this.attemptRecovery(event.service);
      }
    });
  }

  registerService(name: string, service: IHealthCheckable): void {
    this.services.set(name, service);
    this.logger.info(`Health check registered for service: ${name}`);
  }

  unregisterService(name: string): void {
    this.services.delete(name);
    this.logger.info(`Health check unregistered for service: ${name}`);
  }

  async checkHealth(serviceName?: string): Promise<HealthCheckResult | SystemHealthReport> {
    if (serviceName) {
      return this.checkServiceHealth(serviceName);
    }
    
    return this.checkSystemHealth();
  }

  private async checkServiceHealth(serviceName: string): Promise<HealthCheckResult> {
    const service = this.services.get(serviceName);
    
    if (!service) {
      return {
        status: HealthStatus.UNHEALTHY,
        service: serviceName,
        timestamp: new Date(),
        details: {
          error: 'Service not registered for health checks'
        }
      };
    }

    const startTime = Date.now();
    
    try {
      const result = await this.executeWithTimeout(
        () => service.healthCheck(),
        this.config.timeoutMs
      );
      
      result.responseTime = Date.now() - startTime;
      
      // Check resilience status
      if (!this.resilienceManager.isServiceHealthy(serviceName)) {
        result.status = HealthStatus.DEGRADED;
        result.details = {
          ...result.details,
          message: 'Service is degraded due to resilience mechanisms'
        };
      }
      
      return result;
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        service: serviceName,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: (error as Error).message
        }
      };
    }
  }

  private async checkSystemHealth(): Promise<SystemHealthReport> {
    const checks = await Promise.all(
      Array.from(this.services.keys()).map(name => this.checkServiceHealth(name))
    );

    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === HealthStatus.HEALTHY).length,
      degraded: checks.filter(c => c.status === HealthStatus.DEGRADED).length,
      unhealthy: checks.filter(c => c.status === HealthStatus.UNHEALTHY).length
    };

    const criticalServicesHealthy = this.config.criticalServices.every(
      service => {
        const check = checks.find(c => c.service === service);
        return check && check.status !== HealthStatus.UNHEALTHY;
      }
    );

    const overallStatus = this.calculateOverallStatus(summary, criticalServicesHealthy);

    const report: SystemHealthReport = {
      status: overallStatus,
      timestamp: new Date(),
      services: checks,
      summary,
      criticalServicesHealthy
    };

    this.lastHealthCheck = report;
    this.addToHistory(report);
    this.emitHealthStatus(report);

    if (overallStatus === HealthStatus.UNHEALTHY) {
      await this.notifyUnhealthy(report);
    }

    return report;
  }

  private calculateOverallStatus(
    summary: SystemHealthReport['summary'],
    criticalServicesHealthy: boolean
  ): HealthStatus {
    if (!criticalServicesHealthy || summary.unhealthy > 0) {
      return HealthStatus.UNHEALTHY;
    }
    
    if (summary.degraded > 0) {
      return HealthStatus.DEGRADED;
    }
    
    return HealthStatus.HEALTHY;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  startPeriodicHealthChecks(): void {
    if (this.checkInterval) {
      return;
    }

    this.logger.info('Starting periodic health checks', {
      intervalMs: this.config.intervalMs
    });

    this.checkInterval = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        this.logger.error('Periodic health check failed', error as Error);
      }
    }, this.config.intervalMs);

    // Run initial check
    this.checkSystemHealth().catch(error => {
      this.logger.error('Initial health check failed', error);
    });
  }

  stopPeriodicHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      this.logger.info('Stopped periodic health checks');
    }
  }

  private async attemptRecovery(serviceName: string): Promise<void> {
    this.logger.info(`Attempting recovery for service: ${serviceName}`);
    
    try {
      // Reset resilience mechanisms
      this.resilienceManager.resetService(serviceName);
      
      // Wait a bit before rechecking
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Recheck health
      const health = await this.checkServiceHealth(serviceName);
      
      if (health.status === HealthStatus.HEALTHY) {
        this.logger.info(`Service recovered: ${serviceName}`);
        this.eventBus.publish({ type: 'service:recovered', payload: {
          service: serviceName,
          health
        }, metadata: {} } as any);
      } else {
        this.logger.warn(`Service recovery failed: ${serviceName}`, health);
      }
    } catch (error) {
      this.logger.error(`Recovery attempt failed for ${serviceName}`, error as Error);
    }
  }

  private emitHealthStatus(report: SystemHealthReport): void {
    this.eventBus.publish({ type: 'health:check', payload: report, metadata: {} } as any);
    
    report.services.forEach(service => {
      if (service.status === HealthStatus.UNHEALTHY) {
        this.eventBus.publish({ type: 'service:unhealthy', payload: {
          service: service.service,
          health: service
        }, metadata: {} } as any);
      }
    });
  }

  private async notifyUnhealthy(report: SystemHealthReport): Promise<void> {
    if (!this.config.webhookUrl) {
      return;
    }

    try {
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert: 'System Health Alert',
          status: report.status,
          timestamp: report.timestamp,
          unhealthyServices: report.services
            .filter(s => s.status === HealthStatus.UNHEALTHY)
            .map(s => ({
              name: s.service,
              error: s.details?.error
            }))
        })
      });
    } catch (error) {
      this.logger.error('Failed to send health alert', error as Error);
    }
  }

  private addToHistory(report: SystemHealthReport): void {
    this.healthHistory.push(report);
    
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  getHealthHistory(): SystemHealthReport[] {
    return [...this.healthHistory];
  }

  getLastHealthCheck(): SystemHealthReport | undefined {
    return this.lastHealthCheck;
  }

  getServiceHealth(serviceName: string): HealthCheckResult | undefined {
    if (!this.lastHealthCheck) {
      return undefined;
    }
    
    return this.lastHealthCheck.services.find(s => s.service === serviceName);
  }

  isSystemHealthy(): boolean {
    return this.lastHealthCheck?.status === HealthStatus.HEALTHY;
  }

  getUptimePercentage(serviceName?: string, periodMs: number = 86400000): number {
    const now = Date.now();
    const cutoff = new Date(now - periodMs);
    
    const relevantHistory = this.healthHistory.filter(
      h => h.timestamp >= cutoff
    );
    
    if (relevantHistory.length === 0) {
      return 100;
    }

    if (serviceName) {
      const healthyChecks = relevantHistory.filter(h => {
        const service = h.services.find(s => s.service === serviceName);
        return service && service.status === HealthStatus.HEALTHY;
      });
      
      return (healthyChecks.length / relevantHistory.length) * 100;
    }
    
    const healthyChecks = relevantHistory.filter(
      h => h.status === HealthStatus.HEALTHY
    );
    
    return (healthyChecks.length / relevantHistory.length) * 100;
  }
}