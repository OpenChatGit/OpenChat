# Changelog

All notable changes to OpenChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2025-01-22

### Added
- **Source Citation Support** - AI responses now include inline citations `[1]`, `[2]` that reference web search sources
  - Citations appear inline in the text without disrupting reading flow
  - Clickable favicons in "Searched Web" indicator highlight related citations
  - Citations automatically link to their source URLs
  - Full markdown formatting support maintained (tables, lists, code blocks, etc.)
- **Source Registry System** - Centralized management of web search sources with unique IDs
- **Citation Parser** - Robust parsing of citation markers in AI responses
- **Enhanced Web Search Display** - Compact "Searched Web" indicator with interactive source favicons

### Changed
- Improved citation rendering to be non-intrusive and inline
- Updated web search result display to be more compact and user-friendly
- Refined citation styling to match modern citation systems (superscript format)

### Technical
- Implemented `SourceRegistry` for tracking web search sources across chat sessions
- Added `CitationParser` for extracting and parsing citation references
- Enhanced `ContextFormatter` to include citation instructions for LLM
- Integrated citation support into `ChatMessage` component with markdown compatibility

## [0.4.8] - Previous Release

### Features
- Web search integration with automatic context formatting
- Multi-provider support (Ollama, LM Studio, Anthropic, OpenAI, etc.)
- Reasoning model support with collapsible reasoning blocks
- Image attachment support for vision-capable models
- Session management with persistent chat history
- Custom persona/system prompts
- Token usage tracking and display
- Dark mode UI with responsive design

8
