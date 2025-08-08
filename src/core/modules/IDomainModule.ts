import { DependencyContainer } from '../services/ServiceRegistry';
import { IEventBus } from '../event-bus/EventBus';
import { DomainEvent } from '../event-bus/DomainEvent';

/**
 * Base interface for all domain modules
 */

export enum ModuleStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  DISPOSING = 'disposing',
  DISPOSED = 'disposed',
}

export interface ModuleConfig {
  name: string;
  version: string;
  dependencies?: string[];
  enabled?: boolean;
}

export interface ModuleHealth {
  healthy: boolean;
  status: ModuleStatus;
  lastCheck: Date;
  errors?: string[];
  metrics?: Record<string, any>;
}

export interface IDomainModule {
  readonly name: string;
  readonly version: string;
  readonly status: ModuleStatus;
  
  /**
   * Initialize the module with dependencies
   */
  initialize(container: DependencyContainer): Promise<void>;
  
  /**
   * Start the module (after all modules initialized)
   */
  start(): Promise<void>;
  
  /**
   * Stop the module
   */
  stop(): Promise<void>;
  
  /**
   * Dispose the module and clean up resources
   */
  dispose(): Promise<void>;
  
  /**
   * Get module health status
   */
  getHealth(): Promise<ModuleHealth>;
  
  /**
   * Handle a domain event
   */
  handleEvent?(event: DomainEvent): Promise<void>;
  
  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig;
}

/**
 * Base implementation for domain modules
 */
export abstract class BaseDomainModule implements IDomainModule {
  protected container!: DependencyContainer;
  protected eventBus!: IEventBus;
  protected _status: ModuleStatus = ModuleStatus.UNINITIALIZED;
  protected subscriptions: Array<{ unsubscribe: () => void }> = [];
  
  constructor(
    public readonly name: string,
    public readonly version: string,
    protected dependencies: string[] = []
  ) {}
  
  get status(): ModuleStatus {
    return this._status;
  }
  
  async initialize(container: DependencyContainer): Promise<void> {
    try {
      this._status = ModuleStatus.INITIALIZING;
      this.container = container;
      
      // Resolve event bus
      this.eventBus = container.resolve<IEventBus>('IEventBus');
      
      // Module-specific initialization
      await this.onInitialize();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      this._status = ModuleStatus.READY;
    } catch (error) {
      this._status = ModuleStatus.ERROR;
      throw new Error(`Failed to initialize module ${this.name}: ${error}`);
    }
  }
  
  async start(): Promise<void> {
    if (this._status !== ModuleStatus.READY) {
      throw new Error(`Module ${this.name} is not ready to start`);
    }
    
    await this.onStart();
  }
  
  async stop(): Promise<void> {
    if (this._status !== ModuleStatus.READY) {
      return;
    }
    
    await this.onStop();
  }
  
  async dispose(): Promise<void> {
    if (this._status === ModuleStatus.DISPOSED) {
      return;
    }
    
    this._status = ModuleStatus.DISPOSING;
    
    try {
      // Unsubscribe from events
      this.subscriptions.forEach(sub => sub.unsubscribe());
      this.subscriptions = [];
      
      // Module-specific disposal
      await this.onDispose();
      
      this._status = ModuleStatus.DISPOSED;
    } catch (error) {
      console.error(`Error disposing module ${this.name}:`, error);
      this._status = ModuleStatus.ERROR;
    }
  }
  
  async getHealth(): Promise<ModuleHealth> {
    const baseHealth: ModuleHealth = {
      healthy: this._status === ModuleStatus.READY,
      status: this._status,
      lastCheck: new Date(),
    };
    
    // Get module-specific health
    const moduleHealth = await this.onHealthCheck();
    
    return {
      ...baseHealth,
      ...moduleHealth,
    };
  }
  
  getConfig(): ModuleConfig {
    return {
      name: this.name,
      version: this.version,
      dependencies: this.dependencies,
      enabled: true,
    };
  }
  
  /**
   * Subscribe to relevant events
   */
  protected abstract subscribeToEvents(): void;
  
  /**
   * Module-specific initialization
   */
  protected abstract onInitialize(): Promise<void>;
  
  /**
   * Module-specific start logic
   */
  protected abstract onStart(): Promise<void>;
  
  /**
   * Module-specific stop logic
   */
  protected abstract onStop(): Promise<void>;
  
  /**
   * Module-specific disposal
   */
  protected abstract onDispose(): Promise<void>;
  
  /**
   * Module-specific health check
   */
  protected abstract onHealthCheck(): Promise<Partial<ModuleHealth>>;
  
  /**
   * Helper to subscribe to an event
   */
  protected subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => void | Promise<void>
  ): void {
    const subscription = this.eventBus.subscribe(eventType, handler);
    this.subscriptions.push(subscription);
  }
  
  /**
   * Helper to publish an event
   */
  protected async publish(event: DomainEvent): Promise<void> {
    event.metadata.source = this.name;
    await this.eventBus.publish(event);
  }
}

/**
 * Module manager for lifecycle management
 */
export class ModuleManager {
  private modules = new Map<string, IDomainModule>();
  private initOrder: string[] = [];
  
  constructor(private container: DependencyContainer) {}
  
  /**
   * Register a module
   */
  register(module: IDomainModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module ${module.name} is already registered`);
    }
    
    this.modules.set(module.name, module);
    this.initOrder.push(module.name);
  }
  
  /**
   * Initialize all modules
   */
  async initializeAll(): Promise<void> {
    // Since modules depend on services (not other modules),
    // and services are already initialized, we can use registration order
    for (const name of this.initOrder) {
      const module = this.modules.get(name);
      if (!module) {
        throw new Error(`Module ${name} not found in registry`);
      }
      console.log(`Initializing module: ${name}`);
      await module.initialize(this.container);
    }
  }
  
  /**
   * Start all modules
   */
  async startAll(): Promise<void> {
    for (const name of this.initOrder) {
      const module = this.modules.get(name)!;
      await module.start();
    }
  }
  
  /**
   * Stop all modules
   */
  async stopAll(): Promise<void> {
    // Stop in reverse order
    const reversed = [...this.initOrder].reverse();
    
    for (const name of reversed) {
      const module = this.modules.get(name)!;
      await module.stop();
    }
  }
  
  /**
   * Dispose all modules
   */
  async disposeAll(): Promise<void> {
    // Dispose in reverse order
    const reversed = [...this.initOrder].reverse();
    
    for (const name of reversed) {
      const module = this.modules.get(name)!;
      await module.dispose();
    }
    
    this.modules.clear();
    this.initOrder = [];
  }
  
  /**
   * Get a module by name
   */
  getModule(name: string): IDomainModule | undefined {
    return this.modules.get(name);
  }
  
  /**
   * Get all modules
   */
  getAllModules(): IDomainModule[] {
    return Array.from(this.modules.values());
  }
  
  /**
   * Get all modules as a Map
   */
  getAll(): Map<string, IDomainModule> {
    return new Map(this.modules);
  }
  
  /**
   * Get health status of all modules
   */
  async getHealthStatus(): Promise<Record<string, ModuleHealth>> {
    const health: Record<string, ModuleHealth> = {};
    
    for (const [name, module] of this.modules) {
      health[name] = await module.getHealth();
    }
    
    return health;
  }
  
  // (topologicalSort removed - not used in current architecture)
}