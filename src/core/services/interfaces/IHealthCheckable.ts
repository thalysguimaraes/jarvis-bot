export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY'
}

export interface HealthCheckResult {
  status: HealthStatus;
  service: string;
  timestamp: Date;
  responseTime?: number;
  details?: {
    message?: string;
    error?: string;
    metrics?: Record<string, any>;
    dependencies?: HealthCheckResult[];
  };
}

export interface IHealthCheckable {
  /**
   * Perform a health check on the service
   */
  healthCheck(): Promise<HealthCheckResult>;
  
  /**
   * Get the name of the service for health reporting
   */
  getServiceName(): string;
  
  /**
   * Check if the service is currently healthy
   */
  isHealthy(): Promise<boolean>;
}