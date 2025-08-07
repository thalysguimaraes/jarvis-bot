import { TwitterPost, GitHubProject } from './types';

export class ProjectParser {
  constructor(private openAiApiKey: string) {}

  async parseProject(post: TwitterPost): Promise<GitHubProject | null> {
    try {
      // Extract basic information using regex patterns
      const basicInfo = this.extractBasicInfo(post.text);
      
      if (!basicInfo.githubUrl) {
        console.log(`No GitHub URL found in post ${post.id}`);
        return null;
      }

      // Use AI to extract more detailed information
      const aiEnhancedInfo = await this.aiEnhanceProjectInfo(post.text, basicInfo);
      
      // Try to get additional info from GitHub API if possible
      const githubInfo = await this.getGitHubRepoInfo(basicInfo.githubUrl);
      
      // Combine all sources of information
      const project: GitHubProject = {
        title: aiEnhancedInfo.title || githubInfo?.name || this.extractTitleFromUrl(basicInfo.githubUrl),
        description: aiEnhancedInfo.description || githubInfo?.description || 'No description available',
        githubUrl: basicInfo.githubUrl,
        tweetUrl: post.url,
        author: githubInfo?.owner || this.extractAuthorFromUrl(basicInfo.githubUrl),
        stars: githubInfo?.stars,
        language: githubInfo?.language
      };

      return project;
    } catch (error) {
      console.error(`Error parsing project from post ${post.id}:`, error);
      return null;
    }
  }

  private extractBasicInfo(text: string): { githubUrl?: string; title?: string; description?: string } {
    // Extract GitHub URLs
    const githubUrlRegex = /https?:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\/[^\s]*)?/gi;
    const githubUrls = text.match(githubUrlRegex);
    const githubUrl = githubUrls?.[0]?.split('?')[0]; // Remove query parameters

    // Try to extract a title (usually the first meaningful phrase)
    const titleMatch = text.match(/^([^.!?]+)/);
    const possibleTitle = titleMatch?.[1]?.trim();

    // Try to extract description (text after the URL or around project mentions)
    const descriptionParts: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (cleanSentence && 
          !cleanSentence.startsWith('http') && 
          !cleanSentence.includes('@') &&
          cleanSentence.length > 20) {
        descriptionParts.push(cleanSentence);
      }
    }

    return {
      githubUrl,
      title: possibleTitle,
      description: descriptionParts.join('. ')
    };
  }

  private async aiEnhanceProjectInfo(text: string, _basicInfo: any): Promise<{ title?: string; description?: string }> {
    const systemPrompt = `You are a parser that extracts structured information about GitHub projects from social media posts.

Extract:
1. Project title/name (the actual name of the project, not generic descriptions)
2. Project description (what the project does, its purpose, benefits)

Guidelines:
- Title should be concise and specific (e.g., "React Flow", "Vite", "Next.js")
- Description should explain what the project does and why it's useful
- Keep descriptions under 100 words
- If information is unclear, return null for that field

Respond with JSON only: {"title": "project name or null", "description": "what it does or null"}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract project info from: "${text}"` }
          ],
          temperature: 0.3,
          max_tokens: 200,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);
      
      return {
        title: result.title === 'null' ? undefined : result.title,
        description: result.description === 'null' ? undefined : result.description
      };
    } catch (error) {
      console.error('AI enhancement error:', error);
      return {};
    }
  }

  private async getGitHubRepoInfo(githubUrl: string): Promise<{ name?: string; description?: string; stars?: number; language?: string; owner?: string } | null> {
    try {
      // Extract owner and repo from URL
      const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!urlMatch) return null;

      const [, owner, repo] = urlMatch;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'jarvis-bot-github-discovery'
        }
      });

      if (!response.ok) {
        console.log(`GitHub API error for ${owner}/${repo}: ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      
      return {
        name: data.name,
        description: data.description,
        stars: data.stargazers_count,
        language: data.language,
        owner: data.owner?.login || owner
      };
    } catch (error) {
      console.error('Error fetching GitHub repo info:', error);
      return null;
    }
  }

  private extractTitleFromUrl(githubUrl: string): string {
    const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (urlMatch) {
      const [, owner, repo] = urlMatch;
      return repo.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Unknown Project';
  }

  private extractAuthorFromUrl(githubUrl: string): string | undefined {
    const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return urlMatch?.[1];
  }

  async parseMultipleProjects(posts: TwitterPost[]): Promise<GitHubProject[]> {
    const projects: GitHubProject[] = [];
    
    console.log(`Parsing ${posts.length} posts for project details...`);
    
    for (const post of posts) {
      try {
        const project = await this.parseProject(post);
        if (project) {
          projects.push(project);
          console.log(`✓ Parsed project: ${project.title} (${project.githubUrl})`);
        }
        
        // Add delay to be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error parsing project from post ${post.id}:`, error);
        // Continue with other posts
      }
    }
    
    console.log(`Successfully parsed ${projects.length} projects`);
    return projects;
  }

  validateProject(project: GitHubProject): boolean {
    // Basic validation
    if (!project.title || project.title.trim().length === 0) {
      return false;
    }

    if (!project.githubUrl || !project.githubUrl.includes('github.com/')) {
      return false;
    }

    if (!project.description || project.description.trim().length < 10) {
      return false;
    }

    return true;
  }
}