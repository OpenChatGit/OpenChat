# Changelog

All notable changes to OpenChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.8] - 2025-01-23

### Added
- **OpenRouter Provider Integration** - Full support for OpenRouter API with 100+ models
  - Access to models from Anthropic, OpenAI, Google, Meta, Mistral, and more
  - Model filtering and search capabilities for managing large model lists
  - API key support with secure storage
- **Enhanced Model Management**
  - Model filtering system with "Show All" / "Hide All" options
  - Search functionality for finding specific models
  - Real-time model visibility updates in ModelSelector
  - Statistics display (Visible/Hidden/Total models)
- **Light/Dark Theme System**
  - Complete theme implementation with CSS variables
  - Theme toggle in Settings with persistent preference
  - Proper styling for both modes including user bubbles and input containers
- **Model Name Pruning** - Clean display of model names by removing provider prefixes
  - Supports: anthropic/, openai/, google/, nvidia/, amazon/, perplexity/, deepseek/, minimax/, and 15+ more
  - Consistent naming across ModelSelector and Settings
- **Provider Settings Reorganization**
  - Moved provider configuration to dedicated "Providers" sidebar section
  - Individual tabs for each provider (Ollama, LM Studio, OpenAI, Anthropic, OpenRouter)
  - Improved provider information display with setup instructions
- **Enhanced Ollama Documentation**
  - Added Windows app setup instructions
  - Network exposure configuration guide
  - Command-line and GUI setup options

### Changed
- Provider settings now isolated in dedicated sidebar tabs instead of main Settings
- Model selector automatically loads models when opened
- Provider-specific model caching prevents model mixing between providers
- Improved model filtering logic to respect hiddenModels configuration
- Updated selectedProvider when provider configuration changes

### Fixed
- Models not appearing in ModelSelector after being enabled in Settings
- Provider model mixing when switching between providers
- Hidden models not being properly filtered from ModelSelector dropdown
- Cache not respecting hiddenModels changes
- Model visibility not updating in real-time

### Technical
- Implemented provider-specific model caching system
- Enhanced useProviders hook with dynamic model filtering
- Added cleanModelName function for consistent name display
- Improved provider update logic to sync selectedProvider state
- Extended theme system with comprehensive CSS variable support

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
