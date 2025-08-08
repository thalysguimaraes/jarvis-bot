import 'reflect-metadata';

export interface InjectableOptions {
  singleton?: boolean;
  providedIn?: 'root' | string;
  factory?: () => any;
  deps?: Array<any>;
}

export interface ServiceMetadata extends InjectableOptions {
  target: any;
  paramTypes?: any[];
  propertyInjections?: Map<string | symbol, any>;
}

const serviceRegistry = new Map<any, ServiceMetadata>();

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return function(target: any) {
    const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
    
    const metadata: ServiceMetadata = {
      target,
      paramTypes,
      singleton: options.singleton !== false,
      providedIn: options.providedIn || 'root',
      factory: options.factory,
      deps: options.deps,
      propertyInjections: new Map(),
    };
    
    serviceRegistry.set(target, metadata);
    
    Reflect.defineMetadata('injectable', true, target);
    Reflect.defineMetadata('injectable:options', options, target);
    
    return target;
  };
}

export function getServiceMetadata(target: any): ServiceMetadata | undefined {
  return serviceRegistry.get(target);
}

export function getAllServices(): Map<any, ServiceMetadata> {
  return new Map(serviceRegistry);
}

export function isInjectable(target: any): boolean {
  return Reflect.getMetadata('injectable', target) === true;
}

export function clearServiceRegistry(): void {
  serviceRegistry.clear();
}