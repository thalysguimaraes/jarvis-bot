import { GitHubDiscoveryConfig, GitHubProject } from './types';
import { TwitterScraper } from './scraper';
import { ProjectFilter } from './filter';
import { ProjectParser } from './parser';
import { MessageFormatter } from './formatter';
import { GitHubDiscoveryStorage } from './storage';

export class GitHubDiscovery {
  private scraper: TwitterScraper;
  private filter: ProjectFilter;
  private parser: ProjectParser;
  private formatter: MessageFormatter;
  private storage: GitHubDiscoveryStorage;

  constructor(
    private config: GitHubDiscoveryConfig,
    kv: KVNamespace
  ) {
    // Configure TwitterScraper with Railway API settings
    const scraperConfig = {
      railwayApiUrl: config.railwayApiUrl,
      apiKey: config.railwayApiKey
    };
    
    this.scraper = new TwitterScraper(scraperConfig);
    this.filter = new ProjectFilter(config.openAiApiKey);
    this.parser = new ProjectParser(config.openAiApiKey);
    this.formatter = new MessageFormatter();
    this.storage = new GitHubDiscoveryStorage(kv);
  }

  async runDailyDiscovery(): Promise<void> {
    try {
      console.log('Starting GitHub discovery process...');
      
      // Get recent posts from @GithubProjects
      const posts = await this.scraper.getRecentPosts('GithubProjects', 24);
      console.log(`Found ${posts.length} recent posts`);
      
      if (posts.length === 0) {
        await this.sendEmptyReport(0);
        return;
      }

      // Filter out already processed posts
      const newPosts = [];
      for (const post of posts) {
        const alreadyProcessed = await this.storage.hasPostBeenProcessed(post.id);
        if (!alreadyProcessed) {
          newPosts.push(post);
        }
      }

      console.log(`${newPosts.length} new posts to process`);
      
      if (newPosts.length === 0) {
        console.log('All posts have been processed already');
        return;
      }

      // Filter posts to find GitHub project announcements
      const projectPosts = await this.filter.filterPosts(newPosts);
      console.log(`Found ${projectPosts.length} posts that appear to be GitHub projects`);

      // Parse project details from filtered posts
      const projects: GitHubProject[] = [];
      for (const post of projectPosts) {
        try {
          const project = await this.parser.parseProject(post);
          if (project && this.parser.validateProject(project)) {
            projects.push(project);
            
            // Mark post as processed with project found
            await this.storage.markPostAsProcessed({
              tweetId: post.id,
              processedAt: new Date(),
              projectFound: true,
              project
            });
          } else {
            // Mark post as processed but no valid project found
            await this.storage.markPostAsProcessed({
              tweetId: post.id,
              processedAt: new Date(),
              projectFound: false
            });
          }
        } catch (error) {
          console.error(`Error parsing project from post ${post.id}:`, error);
          // Mark as processed to avoid reprocessing
          await this.storage.markPostAsProcessed({
            tweetId: post.id,
            processedAt: new Date(),
            projectFound: false
          });
        }
      }

      // Mark remaining posts as processed (filtered out)
      for (const post of newPosts) {
        if (!projectPosts.some(p => p.id === post.id)) {
          await this.storage.markPostAsProcessed({
            tweetId: post.id,
            processedAt: new Date(),
            projectFound: false
          });
        }
      }

      // Send daily report
      if (projects.length > 0) {
        await this.sendDailyReport(projects, posts.length);
        console.log(`Daily report sent with ${projects.length} projects`);
      } else {
        await this.sendEmptyReport(posts.length);
        console.log('Sent empty report - no projects found');
      }

      // Update last run timestamp
      await this.storage.updateLastRunTimestamp();
      
      // Cleanup old processed posts
      await this.storage.cleanupOldPosts(7);
      
      console.log('GitHub discovery completed successfully');
    } catch (error) {
      console.error('Error in GitHub discovery:', error);
      await this.sendErrorReport(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async testDiscovery(): Promise<{ projects: GitHubProject[]; totalPosts: number }> {
    console.log('Running GitHub discovery test...');
    
    try {
      const posts = await this.scraper.getRecentPosts('GithubProjects', 24);
      const projectPosts = await this.filter.filterPosts(posts.slice(0, 3)); // Test with first 3 posts
      const projects = await this.parser.parseMultipleProjects(projectPosts);
      
      console.log(`Test completed: ${projects.length} projects from ${posts.length} total posts`);
      
      return {
        projects: projects.filter(p => this.parser.validateProject(p)),
        totalPosts: posts.length
      };
    } catch (error) {
      console.error('Error in test discovery:', error);
      return { projects: [], totalPosts: 0 };
    }
  }

  async sendSingleProject(project: GitHubProject): Promise<void> {
    const message = this.formatter.formatSingleProjectMessage(project);
    await this.sendWhatsAppMessage(message);
  }

  async sendTestMessage(projects: GitHubProject[], totalPosts: number): Promise<void> {
    const message = this.formatter.formatTestMessage(projects.length, totalPosts);
    await this.sendWhatsAppMessage(message);
  }

  private async sendDailyReport(projects: GitHubProject[], totalPosts: number): Promise<void> {
    const message = this.formatter.formatDailyReport(projects, totalPosts);
    await this.sendWhatsAppMessage(message);
  }

  private async sendEmptyReport(totalPosts: number): Promise<void> {
    const message = this.formatter.formatDailyReport([], totalPosts);
    await this.sendWhatsAppMessage(message);
  }

  private async sendErrorReport(error: string): Promise<void> {
    const message = this.formatter.formatErrorMessage(error);
    await this.sendWhatsAppMessage(message);
  }

  private async sendWhatsAppMessage(message: string): Promise<void> {
    try {
      const response = await fetch(`https://api.z-api.io/instances/${this.config.zApiInstanceId}/token/${this.config.zApiInstanceToken}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.config.zApiSecurityToken
        },
        body: JSON.stringify({
          phone: this.config.whatsappNumber,
          message: message
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
      }

      console.log('WhatsApp message sent successfully');
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async getRecentDiscoveries(hours = 24): Promise<GitHubProject[]> {
    const processedPosts = await this.storage.getRecentProcessedPosts(hours);
    return processedPosts
      .filter(post => post.projectFound && post.project)
      .map(post => post.project!)
      .filter(project => this.parser.validateProject(project));
  }

  async getStorageStats(): Promise<{ totalProcessed: number; withProjects: number; lastRun?: Date }> {
    const recentPosts = await this.storage.getRecentProcessedPosts(24 * 7); // Last week
    const lastRun = await this.storage.getLastRunTimestamp();
    
    return {
      totalProcessed: recentPosts.length,
      withProjects: recentPosts.filter(p => p.projectFound).length,
      lastRun: lastRun || undefined
    };
  }

  async testScraperConnection(): Promise<{ success: boolean; message: string; sampleTweet?: any }> {
    return await this.scraper.testConnection('GithubProjects');
  }

  isEnabled(): boolean {
    return this.config.enabled !== false && 
           !!this.config.openAiApiKey && 
           !!this.config.zApiInstanceId && 
           !!this.config.zApiInstanceToken && 
           !!this.config.zApiSecurityToken && 
           !!this.config.whatsappNumber;
  }
}

// Export all types and classes
export * from './types';
export * from './scraper';
export * from './filter';
export * from './parser';
export * from './formatter';
export * from './storage';