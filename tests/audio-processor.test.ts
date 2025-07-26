import { describe, it, expect } from 'vitest';
import { AudioProcessor } from '../src/router/AudioProcessor';
import { Env } from '../src/types/env';

describe('AudioProcessor', () => {
  it('should create instance with env', () => {
    const mockEnv: Env = {
      USER_CONFIGS: {} as any,
      WEBHOOK_SECRET: 'test-secret',
      BAILEYS_SERVICE_URL: 'http://localhost:3000',
      OPENAI_API_KEY: 'test-openai',
      TODOIST_API_TOKEN: 'test-todoist',
      ENVIRONMENT: 'development'
    };
    
    const processor = new AudioProcessor(mockEnv);
    expect(processor).toBeDefined();
  });
});