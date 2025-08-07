import { GitHubProject } from './types';

export class MessageFormatter {
  formatDailyReport(projects: GitHubProject[], totalPosts: number): string {
    if (projects.length === 0) {
      return this.formatEmptyReport(totalPosts);
    }

    const header = this.formatHeader(projects.length, totalPosts);
    const projectsSection = this.formatProjectsList(projects);
    const footer = this.formatFooter();

    return `${header}\n\n${projectsSection}\n\n${footer}`;
  }

  private formatHeader(projectCount: number, totalPosts: number): string {
    const date = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const emoji = projectCount > 3 ? '🔥' : projectCount > 1 ? '⭐' : '💡';
    
    return `${emoji} *GitHub Descobertas - ${date}*\n` +
           `Encontrei *${projectCount} projeto${projectCount !== 1 ? 's' : ''}* interessante${projectCount !== 1 ? 's' : ''} de ${totalPosts} posts analisados:`;
  }

  private formatProjectsList(projects: GitHubProject[]): string {
    return projects.map((project, index) => {
      return this.formatSingleProject(project, index + 1);
    }).join('\n\n---\n\n');
  }

  private formatSingleProject(project: GitHubProject, index: number): string {
    const lines: string[] = [];
    
    // Header with title and index
    const titleEmoji = this.getProjectEmoji(project);
    lines.push(`${titleEmoji} *${index}. ${project.title}*`);
    
    // Description
    if (project.description && project.description !== 'No description available') {
      const truncatedDescription = this.truncateDescription(project.description);
      lines.push(`📝 ${truncatedDescription}`);
    }
    
    // GitHub link
    lines.push(`🔗 ${project.githubUrl}`);
    
    // Additional info (stars, language) if available
    const metadata: string[] = [];
    if (project.stars !== undefined && project.stars > 0) {
      const starsFormatted = project.stars > 1000 
        ? `${(project.stars / 1000).toFixed(1)}k` 
        : project.stars.toString();
      metadata.push(`⭐ ${starsFormatted}`);
    }
    
    if (project.language) {
      metadata.push(`💻 ${project.language}`);
    }
    
    if (project.author) {
      metadata.push(`👤 @${project.author}`);
    }
    
    if (metadata.length > 0) {
      lines.push(`${metadata.join(' • ')}`);
    }
    
    // Source tweet link (optional)
    if (project.tweetUrl) {
      lines.push(`📱 Post original: ${project.tweetUrl}`);
    }
    
    return lines.join('\n');
  }

  private getProjectEmoji(project: GitHubProject): string {
    const language = project.language?.toLowerCase();
    const title = project.title.toLowerCase();
    const description = project.description?.toLowerCase() || '';
    
    // Language-specific emojis
    if (language === 'javascript' || language === 'typescript') return '🟨';
    if (language === 'python') return '🐍';
    if (language === 'rust') return '🦀';
    if (language === 'go') return '🐹';
    if (language === 'java') return '☕';
    if (language === 'c++' || language === 'c') return '⚡';
    if (language === 'swift') return '🍎';
    if (language === 'kotlin') return '🤖';
    if (language === 'ruby') return '💎';
    if (language === 'php') return '🐘';
    
    // Project type-specific emojis
    if (title.includes('cli') || description.includes('command line')) return '💻';
    if (title.includes('api') || description.includes('api')) return '🌐';
    if (title.includes('ui') || title.includes('component') || description.includes('component')) return '🎨';
    if (title.includes('game') || description.includes('game')) return '🎮';
    if (title.includes('bot') || description.includes('bot')) return '🤖';
    if (title.includes('ai') || title.includes('ml') || description.includes('machine learning')) return '🧠';
    if (title.includes('tool') || description.includes('tool')) return '🔧';
    if (title.includes('framework') || description.includes('framework')) return '🏗️';
    if (title.includes('library') || description.includes('library')) return '📚';
    
    // Default emoji
    return '🚀';
  }

  private truncateDescription(description: string, maxLength: number = 120): string {
    if (description.length <= maxLength) return description;
    
    // Find the last complete word before the limit
    const truncated = description.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > maxLength * 0.8 
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }

  private formatFooter(): string {
    return `🤖 Descoberto automaticamente pelo Jarvis\n` +
           `⏰ ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  private formatEmptyReport(totalPosts: number): string {
    const date = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `📭 *GitHub Descobertas - ${date}*\n\n` +
           `Analisei ${totalPosts} posts hoje, mas não encontrei novos projetos interessantes.\n\n` +
           `🔍 Continue procurando por novidades amanhã!\n\n` +
           `🤖 Jarvis Discovery Bot`;
  }

  formatSingleProjectMessage(project: GitHubProject): string {
    const emoji = this.getProjectEmoji(project);
    const lines: string[] = [];
    
    lines.push(`${emoji} *Novo Projeto Descoberto!*\n`);
    lines.push(`*${project.title}*`);
    
    if (project.description && project.description !== 'No description available') {
      const truncatedDescription = this.truncateDescription(project.description, 150);
      lines.push(`📝 ${truncatedDescription}`);
    }
    
    lines.push(`🔗 ${project.githubUrl}`);
    
    // Metadata
    const metadata: string[] = [];
    if (project.stars !== undefined && project.stars > 0) {
      const starsFormatted = project.stars > 1000 
        ? `${(project.stars / 1000).toFixed(1)}k` 
        : project.stars.toString();
      metadata.push(`⭐ ${starsFormatted}`);
    }
    
    if (project.language) {
      metadata.push(`💻 ${project.language}`);
    }
    
    if (metadata.length > 0) {
      lines.push(`\n${metadata.join(' • ')}`);
    }
    
    lines.push(`\n🤖 Descoberto pelo Jarvis`);
    
    return lines.join('\n');
  }

  formatErrorMessage(error: string): string {
    return `⚠️ *GitHub Discovery Error*\n\n` +
           `Houve um problema ao buscar novos projetos:\n${error}\n\n` +
           `🔄 Tentarei novamente na próxima execução.\n\n` +
           `🤖 Jarvis Discovery Bot`;
  }

  formatTestMessage(projectCount: number, totalPosts: number): string {
    return `🧪 *Teste GitHub Discovery*\n\n` +
           `✅ Sistema funcionando!\n` +
           `📊 ${projectCount} projetos encontrados de ${totalPosts} posts\n\n` +
           `🤖 Jarvis está pronto para descobrir projetos!`;
  }
}