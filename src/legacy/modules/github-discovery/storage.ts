import { ProcessedPost } from './types';

export class GitHubDiscoveryStorage {
  constructor(private kv: KVNamespace) {}

  private getProcessedPostKey(tweetId: string): string {
    return `github_discovery:post:${tweetId}`;
  }

  private getLastRunKey(): string {
    return 'github_discovery:last_run';
  }

  async hasPostBeenProcessed(tweetId: string): Promise<boolean> {
    const result = await this.kv.get(this.getProcessedPostKey(tweetId));
    return result !== null;
  }

  async markPostAsProcessed(processedPost: ProcessedPost): Promise<void> {
    const key = this.getProcessedPostKey(processedPost.tweetId);
    await this.kv.put(key, JSON.stringify(processedPost), {
      expirationTtl: 86400 * 7 // Keep for 7 days
    });
  }

  async getProcessedPost(tweetId: string): Promise<ProcessedPost | null> {
    const result = await this.kv.get(this.getProcessedPostKey(tweetId));
    if (!result) return null;
    
    return JSON.parse(result);
  }

  async getLastRunTimestamp(): Promise<Date | null> {
    const result = await this.kv.get(this.getLastRunKey());
    if (!result) return null;
    
    return new Date(result);
  }

  async updateLastRunTimestamp(timestamp: Date = new Date()): Promise<void> {
    await this.kv.put(this.getLastRunKey(), timestamp.toISOString());
  }

  async getRecentProcessedPosts(hours = 24): Promise<ProcessedPost[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const list = await this.kv.list({ prefix: 'github_discovery:post:' });
    
    const posts: ProcessedPost[] = [];
    for (const key of list.keys) {
      const post = await this.getProcessedPost(key.name.replace('github_discovery:post:', ''));
      if (post && post.processedAt > cutoff) {
        posts.push(post);
      }
    }
    
    return posts.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }

  async cleanupOldPosts(daysOld = 7): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const list = await this.kv.list({ prefix: 'github_discovery:post:' });
    
    let cleaned = 0;
    for (const key of list.keys) {
      const post = await this.getProcessedPost(key.name.replace('github_discovery:post:', ''));
      if (post && post.processedAt < cutoff) {
        await this.kv.delete(key.name);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}