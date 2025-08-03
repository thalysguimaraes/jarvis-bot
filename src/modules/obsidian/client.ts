import { ObsidianNote, ObsidianConfig, GitHubConfig } from './types';
import { NoteFormatter } from './formatters';

export abstract class ObsidianClient {
  protected config: ObsidianConfig;

  constructor(config: ObsidianConfig) {
    this.config = config;
  }

  abstract saveNote(note: ObsidianNote): Promise<void>;
  abstract getNote(path: string): Promise<string | null>;

  protected getNotePath(note: ObsidianNote): string {
    if (this.config.noteFormat === 'daily') {
      const filename = NoteFormatter.getDailyNoteFilename(note.metadata.timestamp);
      return this.config.notePath ? `${this.config.notePath}/${filename}` : filename;
    } else {
      const filename = NoteFormatter.getIndividualNoteFilename(note.metadata.timestamp);
      return this.config.notePath ? `${this.config.notePath}/${filename}` : filename;
    }
  }
}

export class GitHubObsidianClient extends ObsidianClient {
  private githubConfig: GitHubConfig;

  constructor(config: ObsidianConfig, githubConfig: GitHubConfig) {
    super(config);
    this.githubConfig = githubConfig;
  }

  async saveNote(note: ObsidianNote): Promise<void> {
    const path = this.getNotePath(note);
    const fullPath = `${this.githubConfig.vaultPath}/${path}`;
    
    try {
      if (this.config.noteFormat === 'daily') {
        const existingContent = await this.getNote(path);
        const updatedContent = existingContent 
          ? NoteFormatter.prependToContent(existingContent, note)
          : NoteFormatter.formatDailyNote([note]);
        
        await this.updateFile(fullPath, updatedContent, 'Update daily note');
      } else {
        const content = NoteFormatter.formatNote(note);
        await this.createFile(fullPath, content, 'Add audio note');
      }
    } catch (error) {
      console.error('Error saving note to GitHub:', error);
      throw error;
    }
  }

  async getNote(path: string): Promise<string | null> {
    const fullPath = `${this.githubConfig.vaultPath}/${path}`;
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${fullPath}`,
        {
          headers: {
            'Authorization': `Bearer ${this.githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = atob(data.content);
      return content;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  private async updateFile(path: string, content: string, message: string): Promise<void> {
    const existingFile = await this.getFileInfo(path);
    
    const body: any = {
      message,
      content: btoa(content),
      branch: this.githubConfig.branch || 'main'
    };

    if (existingFile) {
      body.sha = existingFile.sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.githubConfig.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${error}`);
    }
  }

  private async createFile(path: string, content: string, message: string): Promise<void> {
    await this.updateFile(path, content, message);
  }

  private async getFileInfo(path: string): Promise<{ sha: string } | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${this.githubConfig.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json() as any;
      return { sha: data.sha };
    } catch (error) {
      return null;
    }
  }
}