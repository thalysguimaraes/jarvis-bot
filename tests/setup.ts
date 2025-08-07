import { vi } from 'vitest';
import { MockKVNamespace } from './mocks/kv-namespace';
import { MockMessagingService } from './mocks/messaging-service';
import { MockAIService } from './mocks/ai-service';

// Global test setup
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  // Keep console.error for debugging test failures
  // vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Mock fetch globally for API calls
global.fetch = vi.fn();

// Mock crypto for Cloudflare Workers if not already present
if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () => Math.random().toString(36).substring(2, 15),
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {} as SubtleCrypto,
    } as Crypto,
    configurable: true,
    writable: true,
  });
}

// Export mock factories for use in tests
export function createMockKVNamespace(): MockKVNamespace {
  return new MockKVNamespace();
}

export function createMockMessagingService(): MockMessagingService {
  return new MockMessagingService();
}

export function createMockAIService(): MockAIService {
  return new MockAIService();
}

// Helper to create mock environment
export function createMockEnv(overrides?: Partial<any>): any {
  return {
    USER_CONFIGS: createMockKVNamespace(),
    OPENAI_API_KEY: 'test-openai-key',
    Z_API_INSTANCE_ID: 'test-instance-id',
    Z_API_INSTANCE_TOKEN: 'test-instance-token',
    Z_API_SECURITY_TOKEN: 'test-security-token',
    TODOIST_API_TOKEN: 'test-todoist-token',
    BRAPI_TOKEN: 'test-brapi-token',
    ZAISEN_API_KEY: 'test-zaisen-key',
    ZAISEN_API_URL: 'https://test-zaisen.com',
    PORTFOLIO_WHATSAPP_NUMBER: '5511999999999',
    GITHUB_DISCOVERY_WHATSAPP_NUMBER: '5511888888888',
    WEBHOOK_SECRET: 'test-webhook-secret',
    CLASSIFICATION_ENABLED: 'true',
    GITHUB_DISCOVERY_ENABLED: 'false',
    PORTFOLIO_DATA: '[]',
    FUND_PORTFOLIO_DATA: '[]',
    ...overrides,
  };
}

// Helper to create mock execution context
export function createMockExecutionContext(): ExecutionContext {
  const waitUntilPromises: Promise<any>[] = [];
  
  return {
    waitUntil: (promise: Promise<any>) => {
      waitUntilPromises.push(promise);
    },
    passThroughOnException: () => {},
    // For testing, expose the promises so we can await them
    _waitUntilPromises: waitUntilPromises,
  } as any;
}

// Helper to create mock request
export function createMockRequest(options?: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}): Request {
  const { 
    method = 'GET', 
    url = 'https://test.example.com/webhook',
    headers = {},
    body = null,
  } = options || {};
  
  const requestHeaders = new Headers(headers);
  
  return new Request(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : null,
  });
}