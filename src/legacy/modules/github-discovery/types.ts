export interface GitHubProject {
  title: string;
  description: string;
  githubUrl: string;
  tweetUrl?: string;
  author?: string;
  stars?: number;
  language?: string;
}

export interface TwitterPost {
  id: string;
  text: string;
  url: string;
  createdAt: Date;
  author?: string;
  threadPosts?: TwitterPost[];
}

export interface ProjectFilterResult {
  isGitHubProject: boolean;
  confidence: number;
  reasoning: string;
}

export interface ProcessedPost {
  tweetId: string;
  processedAt: Date;
  projectFound: boolean;
  project?: GitHubProject;
}

export interface GitHubDiscoveryConfig {
  openAiApiKey: string;
  zApiInstanceId: string;
  zApiInstanceToken: string;
  zApiSecurityToken: string;
  whatsappNumber: string;
  enabled?: boolean;
  twitterBearerToken?: string;
  twitterCredentials?: {
    username?: string;
    password?: string;
    email?: string;
  };
  // Railway API configuration
  railwayApiUrl?: string;
  railwayApiKey?: string;
}

export interface DailyDiscoveryReport {
  date: string;
  projects: GitHubProject[];
  totalPosts: number;
  projectsFound: number;
  generatedAt: Date;
}