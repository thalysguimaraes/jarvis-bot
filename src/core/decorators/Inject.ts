import 'reflect-metadata';

export type InjectionToken<T = any> = 
  | (new (...args: any[]) => T)
  | string
  | symbol;

export interface InjectOptions {
  optional?: boolean;
  factory?: () => any;
}

const INJECT_METADATA_KEY = 'inject:token';
const INJECT_OPTIONS_KEY = 'inject:options';
const PROPERTY_INJECTIONS_KEY = 'inject:properties';

export function Inject(token?: InjectionToken, options: InjectOptions = {}): ParameterDecorator & PropertyDecorator {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) {
    if (propertyKey === undefined && typeof parameterIndex === 'number') {
      // Parameter injection
      const existingTokens = Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
      const existingOptions = Reflect.getMetadata(INJECT_OPTIONS_KEY, target) || [];
      
      existingTokens[parameterIndex] = token;
      existingOptions[parameterIndex] = options;
      
      Reflect.defineMetadata(INJECT_METADATA_KEY, existingTokens, target);
      Reflect.defineMetadata(INJECT_OPTIONS_KEY, existingOptions, target);
    } else if (propertyKey !== undefined) {
      // Property injection
      const existingProperties = Reflect.getMetadata(PROPERTY_INJECTIONS_KEY, target) || new Map();
      existingProperties.set(propertyKey, { token, options });
      
      Reflect.defineMetadata(PROPERTY_INJECTIONS_KEY, existingProperties, target);
    }
  };
}

export function getInjectionTokens(target: any): InjectionToken[] {
  return Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
}

export function getInjectionOptions(target: any): InjectOptions[] {
  return Reflect.getMetadata(INJECT_OPTIONS_KEY, target) || [];
}

export function getPropertyInjections(target: any): Map<string | symbol, { token: InjectionToken; options: InjectOptions }> {
  return Reflect.getMetadata(PROPERTY_INJECTIONS_KEY, target) || new Map();
}

export function Optional(): ParameterDecorator & PropertyDecorator {
  return Inject(undefined, { optional: true });
}