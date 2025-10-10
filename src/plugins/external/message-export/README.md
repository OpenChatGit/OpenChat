# Message Export Plugin

Export chat sessions to various formats for backup, sharing, or documentation.

## Features

- Export to JSON (full data with metadata)
- Export to Markdown (formatted for readability)
- Export to Plain Text (simple format)
- Download exported files directly

## Usage

### From Code

```typescript
const exportPlugin = pluginManager.get<MessageExportPlugin>('message-export')

// Export as JSON
const jsonData = await exportPlugin.execute({
  format: 'json',
  session: currentSession
})

// Download the export
exportPlugin.downloadExport(
  jsonData,
  `chat-${currentSession.id}.json`,
  'application/json'
)
```

### Export Formats

#### JSON
Complete session data including:
- All messages with timestamps
- Provider and model information
- Session metadata
- Message IDs and roles

#### Markdown
Formatted document with:
- Session title as H1
- Metadata table
- Messages with role indicators
- Proper markdown formatting

#### Plain Text
Simple text format with:
- Session information header
- Messages with role labels
- Separator lines

## Configuration

No configuration required. Plugin works out of the box.

## Version History

### 1.0.0
- Initial release
- JSON export support
- Markdown export support
- Plain text export support
- Download functionality
