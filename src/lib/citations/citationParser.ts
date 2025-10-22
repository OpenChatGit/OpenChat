/**
 * CitationParser - Parses and extracts citation references from text
 * 
 * Supports citation formats:
 * - 【Source X】 - Citation without section
 * - 【Source X, Section Y】 - Citation with section
 * - Case-insensitive matching
 * - Multi-digit source and section IDs
 */

export interface ParsedCitation {
  fullMatch: string;      // Full matched text (e.g., "【Source 2, Section 3】")
  sourceId: number;       // Source ID (e.g., 2)
  sectionId?: number;     // Optional: Section ID (e.g., 3)
  startIndex: number;     // Start position in text
  endIndex: number;       // End position in text
}

export class CitationParser {
  /**
   * Regex pattern for matching citations
   * Matches: 【Source X】 or 【Source X, Section Y】
   * Case-insensitive, supports multi-digit numbers
   */
  private static readonly CITATION_PATTERN = 
    /【Source\s+(\d+)(?:,\s*Section\s+(\d+))?】/gi;

  /**
   * Parses all citations from the given text
   * 
   * @param text - The text to parse for citations
   * @returns Array of parsed citations with metadata
   * 
   * @example
   * const text = "Info 【Source 1】 and 【Source 2, Section 3】";
   * const citations = CitationParser.parse(text);
   * // Returns: [
   * //   { fullMatch: "【Source 1】", sourceId: 1, startIndex: 5, endIndex: 15 },
   * //   { fullMatch: "【Source 2, Section 3】", sourceId: 2, sectionId: 3, startIndex: 20, endIndex: 41 }
   * // ]
   */
  static parse(text: string): ParsedCitation[] {
    if (!text) {
      return [];
    }

    const citations: ParsedCitation[] = [];
    
    // Reset regex state for fresh matching
    const regex = new RegExp(this.CITATION_PATTERN.source, this.CITATION_PATTERN.flags);
    
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const sourceId = parseInt(match[1], 10);
      const sectionId = match[2] ? parseInt(match[2], 10) : undefined;
      
      citations.push({
        fullMatch,
        sourceId,
        sectionId,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length
      });
    }
    
    return citations;
  }

  /**
   * Checks if the text contains any citations
   * 
   * @param text - The text to check
   * @returns true if citations are found, false otherwise
   * 
   * @example
   * CitationParser.hasCitations("Some text 【Source 1】"); // true
   * CitationParser.hasCitations("No citations here"); // false
   */
  static hasCitations(text: string): boolean {
    if (!text) {
      return false;
    }
    
    const regex = new RegExp(this.CITATION_PATTERN.source, this.CITATION_PATTERN.flags);
    return regex.test(text);
  }

  /**
   * Extracts unique source IDs from the text
   * 
   * @param text - The text to extract source IDs from
   * @returns Array of unique source IDs in ascending order
   * 
   * @example
   * const text = "【Source 2】 and 【Source 1】 and 【Source 2, Section 3】";
   * CitationParser.extractSourceIds(text); // Returns: [1, 2]
   */
  static extractSourceIds(text: string): number[] {
    const citations = this.parse(text);
    const uniqueIds = new Set(citations.map(c => c.sourceId));
    return Array.from(uniqueIds).sort((a, b) => a - b);
  }
}
