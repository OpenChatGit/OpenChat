/**
 * SourceRegistry - Central management of source metadata for citation support
 * 
 * This class maintains a registry of web search sources with unique IDs,
 * enabling citation tracking and resolution throughout a chat session.
 */

export interface SourceMetadata {
  id: number;                    // Unique Source-ID (1, 2, 3, ...)
  url: string;                   // Original URL
  title: string;                 // Page title
  domain: string;                // Domain (e.g. "wikipedia.org")
  favicon?: string;              // Favicon URL
  publishedDate?: Date;          // Publication date
  sections: Map<number, string>; // Section-ID -> Section-Content
}

export class SourceRegistry {
  private sources: Map<number, SourceMetadata>;
  private urlToId: Map<string, number>;
  private nextId: number;

  constructor() {
    this.sources = new Map();
    this.urlToId = new Map();
    this.nextId = 1;
  }

  /**
   * Registers a new source and returns the assigned Source-ID
   * If the URL is already registered, returns the existing ID
   * 
   * @param url - The source URL
   * @param title - The page title
   * @param domain - The domain name
   * @param publishedDate - Optional publication date
   * @returns The assigned source ID
   */
  registerSource(
    url: string,
    title: string,
    domain: string,
    publishedDate?: Date
  ): number {
    // Check if URL is already registered
    const existingId = this.urlToId.get(url);
    if (existingId !== undefined) {
      return existingId;
    }

    // Assign new ID and register source
    const id = this.nextId++;
    const metadata: SourceMetadata = {
      id,
      url,
      title,
      domain,
      publishedDate,
      sections: new Map(),
    };

    this.sources.set(id, metadata);
    this.urlToId.set(url, id);

    return id;
  }

  /**
   * Registers a section for a specific source
   * 
   * @param sourceId - The source ID
   * @param sectionId - The section ID
   * @param content - The section content
   */
  registerSection(sourceId: number, sectionId: number, content: string): void {
    const source = this.sources.get(sourceId);
    if (!source) {
      console.warn(`Cannot register section: Source ID ${sourceId} not found`);
      return;
    }

    source.sections.set(sectionId, content);
  }

  /**
   * Retrieves source metadata by ID
   * 
   * @param sourceId - The source ID
   * @returns The source metadata or undefined if not found
   */
  getSource(sourceId: number): SourceMetadata | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Retrieves source ID by URL
   * 
   * @param url - The source URL
   * @returns The source ID or undefined if not found
   */
  getSourceIdByUrl(url: string): number | undefined {
    return this.urlToId.get(url);
  }

  /**
   * Retrieves all registered sources
   * 
   * @returns Array of all source metadata
   */
  getAllSources(): SourceMetadata[] {
    return Array.from(this.sources.values());
  }

  /**
   * Clears all sources (for new chat session)
   */
  clear(): void {
    this.sources.clear();
    this.urlToId.clear();
    this.nextId = 1;
  }
}
