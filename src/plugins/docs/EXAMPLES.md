# Plugin Examples

Real-world examples to help you build your own plugins.

## Example 1: Message Counter

Count and display the number of messages in the current session.

```javascript
class MessageCounterPlugin {
  constructor() {
    this.count = 0
  }
  
  async onLoad() {
    // Load saved count
    this.count = await pluginAPI.storage.get('messageCount', 0)
    
    // Register hook to count messages
    pluginAPI.hooks.register('message.render.user', (context) => {
      this.count++
      pluginAPI.storage.set('messageCount', this.count)
      return context
    })
    
    // Add toolbar button to show count
    pluginAPI.ui.addToolbarButton({
      id: 'message-counter',
      label: 'Messages',
      icon: 'hash',
      onClick: () => {
        pluginAPI.ui.showNotification(
          `Total messages: ${this.count}`,
          'info'
        )
      }
    })
  }
  
  onUnload() {
    pluginAPI.ui.removeToolbarButton('message-counter')
  }
}

export default MessageCounterPlugin
```

**plugin.json:**
```json
{
  "id": "message-counter",
  "name": "Message Counter",
  "version": "1.0.0",
  "description": "Count messages in the current session",
  "author": "Your Name"
}
```

## Example 2: Auto-Emoji

Automatically add emojis to messages based on keywords.

```javascript
class AutoEmojiPlugin {
  constructor() {
    this.emojiMap = {
      'happy': '😊',
      'sad': '😢',
      'love': '❤️',
      'fire': '🔥',
      'star': '⭐',
      'rocket': '🚀',
      'check': '✅',
      'warning': '⚠️'
    }
  }
  
  onLoad() {
    pluginAPI.hooks.register('message.render.user', (context) => {
      let content = context.content
      
      // Replace keywords with emojis
      for (const [keyword, emoji] of Object.entries(this.emojiMap)) {
        const regex = new RegExp(`:${keyword}:`, 'gi')
        content = content.replace(regex, emoji)
      }
      
      context.content = content
      return context
    })
  }
}

export default AutoEmojiPlugin
```

**plugin.json:**
```json
{
  "id": "auto-emoji",
  "name": "Auto Emoji",
  "version": "1.0.0",
  "description": "Convert :keywords: to emojis",
  "author": "Your Name"
}
```

**Usage:**
Type `:happy:` and it becomes 😊

## Example 3: Message Templates

Quick templates for common messages.

```javascript
class MessageTemplatesPlugin {
  constructor() {
    this.templates = {
      'greeting': 'Hello! How can I help you today?',
      'thanks': 'Thank you for your help!',
      'explain': 'Can you explain this in more detail?',
      'code': 'Can you show me the code for this?'
    }
  }
  
  async onLoad() {
    // Load custom templates from storage
    const customTemplates = await pluginAPI.storage.get('templates', {})
    this.templates = { ...this.templates, ...customTemplates }
    
    // Add toolbar button
    pluginAPI.ui.addToolbarButton({
      id: 'templates',
      label: 'Templates',
      icon: 'file-text',
      onClick: () => this.showTemplates()
    })
  }
  
  showTemplates() {
    const templateList = Object.keys(this.templates).join(', ')
    pluginAPI.ui.showNotification(
      `Available templates: ${templateList}`,
      'info'
    )
  }
  
  onUnload() {
    pluginAPI.ui.removeToolbarButton('templates')
  }
}

export default MessageTemplatesPlugin
```

**plugin.json:**
```json
{
  "id": "message-templates",
  "name": "Message Templates",
  "version": "1.0.0",
  "description": "Quick message templates",
  "author": "Your Name"
}
```

## Example 4: Word Replacer

Replace specific words or phrases in messages.

```javascript
class WordReplacerPlugin {
  onLoad() {
    const replacements = pluginAPI.config.get('replacements', {
      'OpenAI': 'AI Provider',
      'GPT': 'Language Model'
    })
    
    pluginAPI.hooks.register('message.render.assistant', (context) => {
      let content = context.content
      
      for (const [from, to] of Object.entries(replacements)) {
        const regex = new RegExp(from, 'gi')
        content = content.replace(regex, to)
      }
      
      context.content = content
      return context
    })
  }
  
  onConfigChange(config) {
    // Reload plugin when config changes
    pluginAPI.ui.showNotification('Replacements updated!', 'success')
  }
}

export default WordReplacerPlugin
```

**plugin.json:**
```json
{
  "id": "word-replacer",
  "name": "Word Replacer",
  "version": "1.0.0",
  "description": "Replace words in messages",
  "author": "Your Name",
  "config": {
    "type": "object",
    "properties": {
      "replacements": {
        "type": "object",
        "title": "Word Replacements",
        "description": "Words to replace (from: to)",
        "default": {
          "OpenAI": "AI Provider"
        }
      }
    }
  }
}
```

## Example 5: Message Logger

Log all messages to storage for later review.

```javascript
class MessageLoggerPlugin {
  async onLoad() {
    // Initialize log
    this.log = await pluginAPI.storage.get('messageLog', [])
    
    // Register hooks for both user and assistant messages
    pluginAPI.hooks.register('message.render.user', (context) => {
      this.logMessage('user', context.content)
      return context
    })
    
    pluginAPI.hooks.register('message.render.assistant', (context) => {
      this.logMessage('assistant', context.content)
      return context
    })
    
    // Add button to view log
    pluginAPI.ui.addToolbarButton({
      id: 'view-log',
      label: 'View Log',
      icon: 'list',
      onClick: () => this.showLog()
    })
  }
  
  async logMessage(role, content) {
    this.log.push({
      role,
      content,
      timestamp: new Date().toISOString()
    })
    
    // Keep only last 100 messages
    if (this.log.length > 100) {
      this.log = this.log.slice(-100)
    }
    
    await pluginAPI.storage.set('messageLog', this.log)
  }
  
  showLog() {
    const count = this.log.length
    pluginAPI.ui.showNotification(
      `Logged ${count} messages`,
      'info'
    )
    console.log('Message Log:', this.log)
  }
  
  onUnload() {
    pluginAPI.ui.removeToolbarButton('view-log')
  }
}

export default MessageLoggerPlugin
```

**plugin.json:**
```json
{
  "id": "message-logger",
  "name": "Message Logger",
  "version": "1.0.0",
  "description": "Log all messages to storage",
  "author": "Your Name"
}
```

## Example 6: Code Formatter

Automatically format code blocks in messages.

```javascript
class CodeFormatterPlugin {
  onLoad() {
    pluginAPI.hooks.register('message.render.assistant', (context) => {
      // Add language hints to code blocks
      let content = context.content
      
      // Detect code blocks without language
      content = content.replace(/```\n/g, '```javascript\n')
      
      context.content = content
      return context
    })
  }
}

export default CodeFormatterPlugin
```

**plugin.json:**
```json
{
  "id": "code-formatter",
  "name": "Code Formatter",
  "version": "1.0.0",
  "description": "Auto-format code blocks",
  "author": "Your Name"
}
```

## Example 7: Session Timer

Track how long you've been in the current session.

```javascript
class SessionTimerPlugin {
  constructor() {
    this.startTime = null
    this.timerInterval = null
  }
  
  onLoad() {
    this.startTime = Date.now()
    
    // Update timer every minute
    this.timerInterval = setInterval(() => {
      this.updateTimer()
    }, 60000)
    
    pluginAPI.ui.addToolbarButton({
      id: 'session-timer',
      label: 'Timer',
      icon: 'clock',
      onClick: () => this.showTime()
    })
  }
  
  updateTimer() {
    const elapsed = Date.now() - this.startTime
    const minutes = Math.floor(elapsed / 60000)
    console.log(`Session time: ${minutes} minutes`)
  }
  
  showTime() {
    const elapsed = Date.now() - this.startTime
    const minutes = Math.floor(elapsed / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    const timeStr = hours > 0 
      ? `${hours}h ${mins}m` 
      : `${mins}m`
    
    pluginAPI.ui.showNotification(
      `Session time: ${timeStr}`,
      'info'
    )
  }
  
  onUnload() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }
    pluginAPI.ui.removeToolbarButton('session-timer')
  }
}

export default SessionTimerPlugin
```

**plugin.json:**
```json
{
  "id": "session-timer",
  "name": "Session Timer",
  "version": "1.0.0",
  "description": "Track session duration",
  "author": "Your Name"
}
```

## Example 8: Custom Shortcuts

Add keyboard shortcuts for common actions.

```javascript
class CustomShortcutsPlugin {
  onLoad() {
    // Listen for keyboard events
    document.addEventListener('keydown', this.handleKeyPress.bind(this))
    
    pluginAPI.ui.showNotification(
      'Shortcuts loaded! Press Ctrl+Shift+H for help',
      'success'
    )
  }
  
  handleKeyPress(event) {
    // Ctrl+Shift+H: Show help
    if (event.ctrlKey && event.shiftKey && event.key === 'H') {
      event.preventDefault()
      this.showHelp()
    }
    
    // Ctrl+Shift+C: Clear messages
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      event.preventDefault()
      pluginAPI.ui.showNotification('Clear shortcut pressed', 'info')
    }
  }
  
  showHelp() {
    const shortcuts = [
      'Ctrl+Shift+H: Show help',
      'Ctrl+Shift+C: Clear messages'
    ]
    
    pluginAPI.ui.showNotification(
      shortcuts.join('\n'),
      'info'
    )
  }
  
  onUnload() {
    document.removeEventListener('keydown', this.handleKeyPress)
  }
}

export default CustomShortcutsPlugin
```

**plugin.json:**
```json
{
  "id": "custom-shortcuts",
  "name": "Custom Shortcuts",
  "version": "1.0.0",
  "description": "Keyboard shortcuts for common actions",
  "author": "Your Name"
}
```

## Tips for Building Plugins

1. **Start Simple**: Begin with a basic plugin and add features incrementally
2. **Test Frequently**: Reload your plugin often during development
3. **Handle Errors**: Always use try-catch blocks
4. **Clean Up**: Remove event listeners and hooks in `onUnload()`
5. **Use Storage**: Persist important data across sessions
6. **Add Config**: Make your plugin configurable for users
7. **Document**: Add comments and a README to your plugin
8. **Test Production**: Always test in the built .exe before releasing

## More Ideas

- **Theme Switcher**: Change UI themes based on time of day
- **Message Search**: Search through message history
- **Export Tools**: Export conversations in different formats
- **Statistics**: Track usage statistics and insights
- **Integrations**: Connect to external services (with permissions)
- **Custom Commands**: Add slash commands for quick actions
- **Auto-Save**: Automatically save important conversations
- **Reminders**: Set reminders based on message content

Happy plugin building! 🚀
