import { Env } from '@/types/env';
import { ObsidianConfig, GitHubConfig } from '@/modules/obsidian';

export class Config {
  static isClassificationEnabled(env: Env): boolean {
    return env.CLASSIFICATION_ENABLED !== 'false';
  }

  static getClassificationThreshold(env: Env): number {
    const threshold = parseFloat(env.CLASSIFICATION_CONFIDENCE_THRESHOLD || '0.8');
    return isNaN(threshold) ? 0.8 : Math.max(0, Math.min(1, threshold));
  }

  static hasObsidianConfig(env: Env): boolean {
    return !!(env.OBSIDIAN_STORAGE_TYPE && this.getStorageConfig(env));
  }

  static getObsidianConfig(env: Env): ObsidianConfig | null {
    if (!env.OBSIDIAN_STORAGE_TYPE) {
      return null;
    }

    return {
      storageType: env.OBSIDIAN_STORAGE_TYPE,
      dailyNote: env.OBSIDIAN_NOTE_FORMAT !== 'individual',
      noteFormat: env.OBSIDIAN_NOTE_FORMAT || 'daily',
      notePath: env.OBSIDIAN_NOTE_PATH
    };
  }

  static getGitHubConfig(env: Env): GitHubConfig | null {
    if (env.OBSIDIAN_STORAGE_TYPE !== 'github') {
      return null;
    }

    // Log what we're checking
    console.log('GitHub config check in getGitHubConfig:', {
      hasToken: !!env.GITHUB_TOKEN,
      tokenLength: env.GITHUB_TOKEN?.length,
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
      vaultPath: env.OBSIDIAN_VAULT_PATH
    });

    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.OBSIDIAN_VAULT_PATH) {
      console.error('Missing required GitHub configuration:', {
        hasToken: !!env.GITHUB_TOKEN,
        hasOwner: !!env.GITHUB_OWNER,
        hasRepo: !!env.GITHUB_REPO,
        hasVaultPath: !!env.OBSIDIAN_VAULT_PATH
      });
      return null;
    }

    return {
      token: env.GITHUB_TOKEN,
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
      branch: env.GITHUB_BRANCH || 'main',
      vaultPath: env.OBSIDIAN_VAULT_PATH
    };
  }

  private static getStorageConfig(env: Env): any {
    switch (env.OBSIDIAN_STORAGE_TYPE) {
      case 'github':
        return this.getGitHubConfig(env);
      default:
        return null;
    }
  }
}