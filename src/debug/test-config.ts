import { Env } from '@/types/env';
import { Config } from '@/utils/config';

export function testConfiguration(env: Env): any {
  const response = {
    environment: env.ENVIRONMENT,
    hasRequiredKeys: {
      OPENAI_API_KEY: !!env.OPENAI_API_KEY,
      TODOIST_API_TOKEN: !!env.TODOIST_API_TOKEN,
      WEBHOOK_SECRET: !!env.WEBHOOK_SECRET,
      Z_API_INSTANCE_ID: !!env.Z_API_INSTANCE_ID,
      Z_API_INSTANCE_TOKEN: !!env.Z_API_INSTANCE_TOKEN,
      Z_API_SECURITY_TOKEN: !!env.Z_API_SECURITY_TOKEN
    },
    classification: {
      enabled: Config.isClassificationEnabled(env),
      threshold: Config.getClassificationThreshold(env)
    },
    obsidian: {
      storageType: env.OBSIDIAN_STORAGE_TYPE,
      hasConfig: Config.hasObsidianConfig(env),
      config: Config.getObsidianConfig(env),
      github: {
        hasToken: !!env.GITHUB_TOKEN,
        tokenPreview: env.GITHUB_TOKEN ? `${env.GITHUB_TOKEN.substring(0, 10)}...` : 'not set',
        owner: env.GITHUB_OWNER || 'not set',
        repo: env.GITHUB_REPO || 'not set',
        vaultPath: env.OBSIDIAN_VAULT_PATH,
        noteFormat: env.OBSIDIAN_NOTE_FORMAT,
        config: Config.getGitHubConfig(env)
      }
    }
  };
  
  return response;
}