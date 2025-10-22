/**
 * ContextFormatter - Formats processed context for AI models
 * Supports multiple output formats: verbose, compact, and JSON
 */

import type {
  ProcessedContext,
  ContentChunk,
  Source,
  OutputFormat
} from './types';
import { SourceRegistry } from './sourceRegistry';

export class ContextFormatter {
  private sourceRegistry?: SourceRegistry;

  /**
   * Constructor
   * @param sourceRegistry - Optional SourceRegistry for citation support
   */
  constructor(sourceRegistry?: SourceRegistry) {
    this.sourceRegistry = sourceRegistry;
  }

  /**
   * Format processed context into specified output format
   */
  format(context: ProcessedContext, format: OutputFormat = 'verbose'): string {
    switch (format) {
      case 'verbose':
        return this.formatVerbose(context);
      case 'compact':
        return this.formatCompact(context);
      case 'json':
        return this.formatJSON(context);
      default:
        return this.formatVerbose(context);
    }
  }

  /**
   * Format processed context with citation support
   * Registers sources in the SourceRegistry and adds citation instructions
   * 
   * @param context - The processed context to format
   * @param format - The output format (default: 'verbose')
   * @returns Formatted context with citation instructions
   */
  formatWithCitations(context: ProcessedContext, format: OutputFormat = 'verbose'): string {
    if (!this.sourceRegistry) {
      console.warn('SourceRegistry not available, falling back to standard format');
      return this.format(context, format);
    }

    // Register sources from chunks
    this.registerSources(context.chunks);

    // Format the context
    let formattedContext = this.format(context, format);

    // Add citation instructions
    formattedContext = this.addCitationInstructions(formattedContext);

    return formattedContext;
  }

  /**
   * Format in verbose mode with structured output
   */
  private formatVerbose(context: ProcessedContext): string {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let output = '';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += `📊 WEB SEARCH RESULTS (Retrieved: ${date})\n`;
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    output += `Search Query: "${context.query}"\n`;
    output += `Total Sources: ${context.chunks.length} relevant sections from ${new Set(context.chunks.map(c => c.source)).size} websites\n\n`;

    // Group chunks by source
    const chunksBySource = this.groupChunksBySource(context.chunks);
    let sourceIndex = 1;

    for (const [source, chunks] of chunksBySource.entries()) {
      const firstChunk = chunks[0];
      const domain = firstChunk.metadata.domain;
      const url = new URL(source);
      const title = this.extractTitleFromURL(url);

      // Get source ID from registry if available
      const sourceId = this.sourceRegistry?.getSourceIdByUrl(source);
      const sourceLabel = sourceId !== undefined ? `SOURCE ${sourceId}` : `SOURCE ${sourceIndex}`;

      output += `\n📄 ${sourceLabel}: ${title}\n`;
      output += `   Domain: ${domain}\n`;
      
      if (firstChunk.metadata.publishedDate) {
        const pubDate = firstChunk.metadata.publishedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        output += `   Published: ${pubDate}\n`;
      }
      
      output += `   URL: ${source}\n`;
      output += `   Relevance: ${chunks.length} section(s) selected\n\n`;

      // Add all chunks from this source
      let chunkIndex = 1;
      for (const chunk of chunks) {
        output += `   [Section ${chunkIndex}]\n`;
        output += `   ${chunk.content.split('\n').join('\n   ')}\n\n`;
        chunkIndex++;
      }

      output += '   ' + '─'.repeat(60) + '\n';
      sourceIndex++;
    }

    output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += 'END OF WEB SEARCH RESULTS\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return output;
  }

  /**
   * Format in compact mode for token efficiency
   */
  private formatCompact(context: ProcessedContext): string {
    let output = `Search: ${context.query}\n\n`;

    // Group chunks by domain for compact display
    const chunksByDomain = new Map<string, ContentChunk[]>();
    
    for (const chunk of context.chunks) {
      const domain = chunk.metadata.domain;
      if (!chunksByDomain.has(domain)) {
        chunksByDomain.set(domain, []);
      }
      chunksByDomain.get(domain)!.push(chunk);
    }

    // Output chunks grouped by domain
    for (const [domain, chunks] of chunksByDomain.entries()) {
      for (const chunk of chunks) {
        output += `[${domain}]: ${chunk.content}\n\n`;
      }
    }

    // Add sources list
    const sources = this.extractSources(context.chunks);
    output += 'Sources: ';
    output += sources.map(s => s.url).join(', ');
    output += '\n';

    return output;
  }

  /**
   * Format as JSON for structured processing
   */
  private formatJSON(context: ProcessedContext): string {
    const sources = this.extractSources(context.chunks);
    
    const jsonOutput = {
      query: context.query,
      timestamp: new Date().toISOString(),
      totalChunks: context.totalChunks,
      selectedChunks: context.selectedChunks,
      chunks: context.chunks.map(chunk => ({
        content: chunk.content,
        source: chunk.source,
        relevanceScore: chunk.relevanceScore,
        position: chunk.position,
        metadata: {
          wordCount: chunk.metadata.wordCount,
          publishedDate: chunk.metadata.publishedDate?.toISOString(),
          domain: chunk.metadata.domain,
          isTrustedDomain: chunk.metadata.isTrustedDomain
        }
      })),
      sources: sources.map(source => ({
        url: source.url,
        title: source.title,
        domain: source.domain,
        publishedDate: source.publishedDate?.toISOString()
      }))
    };

    return JSON.stringify(jsonOutput, null, 2);
  }

  /**
   * Group chunks by their source URL
   */
  private groupChunksBySource(chunks: ContentChunk[]): Map<string, ContentChunk[]> {
    const grouped = new Map<string, ContentChunk[]>();

    for (const chunk of chunks) {
      if (!grouped.has(chunk.source)) {
        grouped.set(chunk.source, []);
      }
      grouped.get(chunk.source)!.push(chunk);
    }

    return grouped;
  }

  /**
   * Extract title from URL
   */
  private extractTitleFromURL(url: URL): string {
    // Try to extract a readable title from the URL path
    const path = url.pathname;
    const segments = path.split('/').filter(s => s.length > 0);
    
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      // Remove file extensions and convert dashes/underscores to spaces
      return lastSegment
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    return url.hostname;
  }

  /**
   * Extract unique sources from chunks
   */
  private extractSources(chunks: ContentChunk[]): Source[] {
    const sourceMap = new Map<string, Source>();

    for (const chunk of chunks) {
      if (!sourceMap.has(chunk.source)) {
        const url = new URL(chunk.source);
        sourceMap.set(chunk.source, {
          url: chunk.source,
          title: this.extractTitleFromURL(url),
          domain: chunk.metadata.domain,
          publishedDate: chunk.metadata.publishedDate
        });
      }
    }

    return Array.from(sourceMap.values());
  }

  /**
   * Optimize context length to fit within maximum
   */
  optimizeLength(context: string, maxLength: number): string {
    if (context.length <= maxLength) {
      return context;
    }

    // Truncate and add notice
    const truncated = context.substring(0, maxLength - 100);
    const lastNewline = truncated.lastIndexOf('\n');
    
    // Try to cut at a natural boundary
    const cutPoint = lastNewline > maxLength * 0.8 ? lastNewline : truncated.length;
    const result = truncated.substring(0, cutPoint);
    
    return result + '\n\n[Content truncated due to length constraints]';
  }

  /**
   * Add source attribution to formatted context
   */
  addSourceAttribution(context: string, sources: Source[]): string {
    if (sources.length === 0) {
      return context;
    }

    let output = context;
    output += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += '📚 SOURCES\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // Group sources by domain
    const sourcesByDomain = this.groupSourcesByDomain(sources);

    for (const [domain, domainSources] of sourcesByDomain.entries()) {
      output += `${domain}:\n`;
      
      for (const source of domainSources) {
        output += `  • ${source.title}\n`;
        output += `    ${source.url}\n`;
        
        if (source.publishedDate) {
          const dateStr = source.publishedDate.toLocaleDateString('de-DE');
          output += `    Published: ${dateStr}\n`;
        }
        
        output += '\n';
      }
    }

    return output;
  }

  /**
   * Group sources by domain
   */
  private groupSourcesByDomain(sources: Source[]): Map<string, Source[]> {
    const grouped = new Map<string, Source[]>();

    for (const source of sources) {
      if (!grouped.has(source.domain)) {
        grouped.set(source.domain, []);
      }
      grouped.get(source.domain)!.push(source);
    }

    return grouped;
  }

  /**
   * Add citation instructions for the LLM
   * Appends instructions on how to use the citation format
   * 
   * @param formattedContext - The formatted context
   * @returns Context with citation instructions appended
   */
  private addCitationInstructions(formattedContext: string): string {
    const instructions = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 CITATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: When referencing information from the web search results above, 
you MUST cite your sources using the following format:

【Source X, Section Y】

Where:
- X is the source number (1, 2, 3, etc.) as shown in the results above
- Y is the section number within that source (1, 2, 3, etc.)

Example: "Python 3.14.0 was released on October 7, 2025 【Source 2, Section 2】"

You can also cite without a section number if referring to the source in general:
Example: "According to the official documentation 【Source 1】"

Rules:
- Always place citations immediately after the relevant information
- Use the exact format with the special brackets 【】
- Multiple citations can be used in a single response
- Cite specific sections when possible for better traceability

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    return formattedContext + instructions;
  }

  /**
   * Register sources from chunks in the SourceRegistry
   * Groups chunks by source URL and registers each unique source
   * Also registers sections for each source
   * 
   * @param chunks - The content chunks to register
   */
  private registerSources(chunks: ContentChunk[]): void {
    if (!this.sourceRegistry) {
      return;
    }

    // Group chunks by source URL
    const chunksBySource = this.groupChunksBySource(chunks);

    for (const [sourceUrl, sourceChunks] of chunksBySource.entries()) {
      const firstChunk = sourceChunks[0];
      const url = new URL(sourceUrl);
      const title = this.extractTitleFromURL(url);
      const domain = firstChunk.metadata.domain;
      const publishedDate = firstChunk.metadata.publishedDate;

      // Register the source and get its ID
      const sourceId = this.sourceRegistry.registerSource(
        sourceUrl,
        title,
        domain,
        publishedDate
      );

      // Register each chunk as a section
      sourceChunks.forEach((chunk, index) => {
        const sectionId = index + 1; // 1-based section IDs
        this.sourceRegistry!.registerSection(sourceId, sectionId, chunk.content);
      });
    }
  }
}
