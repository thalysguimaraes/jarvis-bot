import { TwitterPost, ProjectFilterResult } from './types';

export class ProjectFilter {
  constructor(private openAiApiKey: string) {}

  async isGitHubProject(post: TwitterPost): Promise<ProjectFilterResult> {
    try {
      // First do a quick keyword check
      const keywordResult = this.keywordFilter(post.text);
      
      // If keyword confidence is very low, skip AI call to save costs
      if (keywordResult.confidence < 0.3) {
        return keywordResult;
      }

      // Use AI for more sophisticated filtering
      const aiResult = await this.aiFilter(post.text);
      
      // Combine keyword and AI results
      const combinedConfidence = (keywordResult.confidence + aiResult.confidence) / 2;
      
      return {
        isGitHubProject: aiResult.isGitHubProject && keywordResult.isGitHubProject,
        confidence: combinedConfidence,
        reasoning: `Keywords: ${keywordResult.reasoning}, AI: ${aiResult.reasoning}`
      };
    } catch (error) {
      console.error('AI filtering failed, using keyword fallback:', error);
      return this.keywordFilter(post.text);
    }
  }

  private keywordFilter(text: string): ProjectFilterResult {
    const lowerText = text.toLowerCase();
    
    // Strong indicators of GitHub projects
    const strongIndicators = [
      'github.com/',
      'github repo',
      'repository',
      'open source',
      'check out this',
      'new library',
      'new framework',
      'stars',
      '⭐',
      'npm package',
      'python package',
      'rust crate',
      'go module'
    ];

    // Weak indicators that suggest it might be a project
    const weakIndicators = [
      'tool',
      'cli',
      'api',
      'sdk',
      'package',
      'library',
      'framework',
      'component',
      'utility',
      'plugin',
      'extension'
    ];

    // Negative indicators (suggests it's not a project announcement)
    const negativeIndicators = [
      'just thinking',
      'opinion',
      'feeling',
      'weather',
      'coffee',
      'lunch',
      'working on my',
      'personal project',
      'learning',
      'tutorial',
      'question',
      'help me',
      'stuck on',
      'debugging'
    ];

    let score = 0;
    let reasoning = '';

    // Check for strong indicators (high weight)
    const foundStrong = strongIndicators.filter(indicator => lowerText.includes(indicator));
    score += foundStrong.length * 3;
    if (foundStrong.length > 0) {
      reasoning += `Strong indicators: ${foundStrong.join(', ')}. `;
    }

    // Check for weak indicators (low weight)
    const foundWeak = weakIndicators.filter(indicator => lowerText.includes(indicator));
    score += foundWeak.length * 1;
    if (foundWeak.length > 0) {
      reasoning += `Weak indicators: ${foundWeak.join(', ')}. `;
    }

    // Check for negative indicators (subtract points)
    const foundNegative = negativeIndicators.filter(indicator => lowerText.includes(indicator));
    score -= foundNegative.length * 2;
    if (foundNegative.length > 0) {
      reasoning += `Negative indicators: ${foundNegative.join(', ')}. `;
    }

    // Check for GitHub URL pattern
    const githubUrlRegex = /https?:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/gi;
    const githubUrls = text.match(githubUrlRegex);
    if (githubUrls && githubUrls.length > 0) {
      score += 5; // Strong boost for actual GitHub URLs
      reasoning += `GitHub URLs found: ${githubUrls.length}. `;
    }

    // Normalize score to 0-1 range
    const confidence = Math.min(Math.max(score / 8, 0), 1);
    const isGitHubProject = confidence > 0.6;

    return {
      isGitHubProject,
      confidence,
      reasoning: reasoning.trim() || 'No specific indicators found'
    };
  }

  private async aiFilter(text: string): Promise<ProjectFilterResult> {
    const systemPrompt = `You are a classifier that determines if a social media post is announcing or showcasing a GitHub project/repository.

A GitHub project announcement typically:
- Mentions a specific code repository, library, tool, or framework
- Includes links to GitHub repositories
- Describes what the project does and its benefits
- May mention stars, contributors, or technical details
- Uses language like "check out", "built", "created", "released", "new"

NOT a GitHub project announcement:
- Personal thoughts, opinions, or experiences
- General programming discussions without specific repos
- Questions or requests for help
- Casual observations about coding
- Learning experiences or tutorials
- Work-in-progress personal projects without public repos

Respond with JSON only: {"isGitHubProject": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

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
            { role: 'user', content: `Classify this post: "${text}"` }
          ],
          temperature: 0.3,
          max_tokens: 150,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);
      
      return {
        isGitHubProject: result.isGitHubProject || false,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'AI classification'
      };
    } catch (error) {
      console.error('AI filtering error:', error);
      throw error;
    }
  }

  async filterPosts(posts: TwitterPost[]): Promise<TwitterPost[]> {
    const filteredPosts: TwitterPost[] = [];
    
    console.log(`Filtering ${posts.length} posts for GitHub projects...`);
    
    for (const post of posts) {
      try {
        const filterResult = await this.isGitHubProject(post);
        
        console.log(`Post ${post.id}: ${filterResult.isGitHubProject ? 'MATCH' : 'NO MATCH'} (confidence: ${filterResult.confidence.toFixed(2)}) - ${filterResult.reasoning}`);
        
        if (filterResult.isGitHubProject && filterResult.confidence > 0.6) {
          filteredPosts.push(post);
        }
        
        // Add small delay to be respectful to OpenAI API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error filtering post ${post.id}:`, error);
        // Continue with other posts even if one fails
      }
    }
    
    console.log(`Filtered down to ${filteredPosts.length} potential GitHub project posts`);
    return filteredPosts;
  }
}