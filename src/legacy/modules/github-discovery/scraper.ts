import { TwitterPost } from './types';

interface RailwayAPIResponse {
  success: boolean;
  posts: TwitterPost[];
  total_posts: number;
  github_posts: number;
  error?: string;
}

export class TwitterScraper {
  private railwayApiUrl: string;
  private apiKey: string;

  constructor(config?: { railwayApiUrl?: string; apiKey?: string }) {
    this.railwayApiUrl = config?.railwayApiUrl || process.env.GITHUB_SCRAPER_API_URL || '';
    this.apiKey = config?.apiKey || process.env.GITHUB_SCRAPER_API_KEY || '';
    
    console.log('Initializing Railway API scraper for GitHub discovery');
    console.log(`API URL configured: ${!!this.railwayApiUrl}`);
    console.log(`API Key configured: ${!!this.apiKey}`);
  }

  async getRecentPosts(username: string, hours = 24): Promise<TwitterPost[]> {
    try {
      console.log(`Calling Railway API to scrape @${username} (last ${hours} hours)...`);
      
      if (!this.railwayApiUrl) {
        console.error('Railway API URL not configured');
        return [];
      }

      if (!this.apiKey) {
        console.error('Railway API key not configured');
        return [];
      }

      const response = await fetch(`${this.railwayApiUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          hours: hours,
          limit: 20
        })
      });

      if (!response.ok) {
        console.error(`Railway API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return [];
      }

      const data: RailwayAPIResponse = await response.json();
      
      if (!data.success) {
        console.error('Railway API returned error:', data.error);
        return [];
      }

      console.log(`✓ Railway API found ${data.posts.length} GitHub posts from ${data.total_posts} total tweets`);
      
      // Convert date strings to Date objects if needed
      const posts = data.posts.map(post => ({
        ...post,
        createdAt: typeof post.createdAt === 'string' ? new Date(post.createdAt) : post.createdAt
      }));

      return posts;
    } catch (error) {
      console.error(`Error calling Railway API for @${username}:`, error);
      return [];
    }
  }

  async getPostThread(postId: string): Promise<TwitterPost[]> {
    try {
      // Thread fetching not implemented for Railway API yet
      console.log(`Thread fetching for ${postId} not implemented yet`);
      return [];
    } catch (error) {
      console.error('Error fetching thread:', error);
      return [];
    }
  }

  async validatePost(post: TwitterPost): Promise<boolean> {
    // Basic validation - ensure post has content and isn't too old
    if (!post.text || post.text.trim().length < 10) {
      return false;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (post.createdAt < oneDayAgo) {
      return false;
    }

    return true;
  }

  async testConnection(username: string): Promise<{ success: boolean; message: string; sampleTweet?: any }> {
    try {
      console.log(`Testing Railway API connection for @${username}...`);
      
      if (!this.railwayApiUrl || !this.apiKey) {
        return {
          success: false,
          message: 'Railway API not configured - missing URL or API key'
        };
      }

      // Test health endpoint first
      const healthResponse = await fetch(`${this.railwayApiUrl}/health`);
      
      if (!healthResponse.ok) {
        return {
          success: false,
          message: `Railway API health check failed: ${healthResponse.status}`
        };
      }

      const healthData = await healthResponse.json();
      
      if (!healthData.twitter_ready) {
        return {
          success: false,
          message: 'Railway API is healthy but Twitter authentication not ready'
        };
      }

      // Test with a small scraping request
      const posts = await this.getRecentPosts(username, 1); // Just 1 hour
      
      return {
        success: true,
        message: `Successfully connected to Railway API. Found ${posts.length} GitHub posts.`,
        sampleTweet: posts.length > 0 ? {
          id: posts[0].id,
          text: posts[0].text.substring(0, 100) + '...',
          date: posts[0].createdAt,
        } : {
          id: 'railway_test',
          text: 'Railway API connection successful but no GitHub posts found.',
          date: new Date(),
        }
      };
    } catch (error) {
      console.error('Railway API connection test failed:', error);
      return {
        success: false,
        message: `Railway API connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}