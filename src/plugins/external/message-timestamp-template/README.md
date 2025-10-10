# Message Timestamp Plugin Template

A **working, functional UI extension plugin** that displays timestamps under user messages.

> 🎯 **This is a TEMPLATE** - Copy this folder and customize it to create your own UI extension plugins!

## 🎯 What This Plugin Does

This plugin demonstrates the **UI Extension Plugin System**:

- ✅ **Displays timestamps** under user messages
- ✅ **Automatically enabled/disabled** via plugin system
- ✅ **Generic system** - works for ANY UI extension plugin
- ✅ **No hardcoding** - fully plugin-based

This template shows you how to:
- Create UI extension plugins
- Add components to specific locations
- Use the plugin lifecycle hooks
- Enable/disable functionality dynamically

## 📸 Preview

Timestamps are automatically shown:
```
┌─────────────────────┐
│ Hello, how are you? │
└─────────────────────┘
  10:30 AM
```

## 🚀 How to Use This Template

### 1. Copy This Folder

```bash
cp -r message-timestamp-template my-plugin-name
cd my-plugin-name
```

### 2. Customize plugin.json

Change the plugin details:

```json
{
  "id": "my-plugin",
  "name": "My Plugin Name",
  "version": "1.0.0",
  "description": "What your plugin does",
  "author": "Your Name",
  "type": "ui-extension",
  "appVersion": "1.0.0",
  "core": false
}
```

### 3. Create Your Component

Create a component in `components/`:

```tsx
// components/MyComponent.tsx
import type { Message } from '../../../../types'

interface MyComponentProps {
  message: Message
}

export function MyComponent({ message }: MyComponentProps) {
  return (
    <div className="text-xs text-gray-500 px-2">
      Your custom UI here
    </div>
  )
}
```

### 4. Update the Plugin

Edit `index.tsx`:

```typescript
import type { UIExtensionPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'
import { MyComponent } from './components/MyComponent'

export class MyPlugin implements UIExtensionPlugin {
  metadata: PluginMetadata & { type: 'ui-extension' } = {
    ...(manifestData as any),
    enabled: true,
  }

  // Choose location: 'user-message-footer', 'ai-message-footer', 'sidebar', etc.
  location = 'user-message-footer'
  
  // Your component
  component = MyComponent

  onLoad() {
    console.log('Plugin loaded!')
  }
}
```

### 5. Test It!

Restart OpenChat and your plugin will be automatically loaded.

## 📁 File Structure

```
message-timestamp-template/
├── plugin.json                      # Plugin metadata (required)
├── index.tsx                        # Main plugin file (required)
├── components/
│   └── TimestampDisplay.tsx         # UI component
└── README.md                        # This file
```

## 🔧 Plugin System

### UI Extension Locations

| Location | Description | Use Case |
|----------|-------------|----------|
| `user-message-footer` | Under user messages | Timestamps, edit buttons, reactions |
| `ai-message-footer` | Under AI messages | Feedback buttons, copy actions |
| `sidebar` | In the sidebar | Custom panels, tools |
| `toolbar` | In the toolbar | Quick actions, toggles |
| `message-actions` | Message action buttons | Custom actions per message |
| `settings` | In settings panel | Plugin configuration |

### How It Works

1. **Plugin enabled** (`enabled: true`) → Component renders
2. **Plugin disabled** (`enabled: false`) → Component hidden
3. **No hardcoding** → System automatically manages all plugins
4. **Generic** → Works for ANY UI extension plugin

## 💡 Customization Ideas

Based on this template, you could create:

1. **Auto-Signature**: Add your signature to every message
2. **Message Counter**: Add message numbers (e.g., "Message #5")
3. **Character Counter**: Show character count
4. **Auto-Translator**: Translate messages before sending
5. **Profanity Filter**: Filter inappropriate content
6. **Text Formatter**: Auto-format text (uppercase, lowercase, etc.)

## 🎨 Styling

The component uses Tailwind CSS classes:

```tsx
<div className="text-xs text-gray-500 mt-1">
  Your content
</div>
```

Common classes:
- `text-xs`, `text-sm`, `text-base` - Font sizes
- `text-gray-500`, `text-blue-600` - Colors
- `mt-1`, `mb-2`, `px-4`, `py-2` - Spacing
- `rounded`, `rounded-lg` - Border radius
- `hover:bg-gray-700` - Hover effects

## 🐛 Debugging

Add console logs to debug:

```typescript
onLoad() {
  console.log('[My Plugin] Loaded')
  console.log('Config:', this.metadata)
}
```

Check the browser console for:
- `[Message Timestamp (Template)] v1.0.0 loaded` - Plugin loaded successfully
- Error messages if something went wrong

## 📚 Resources

- [Plugin Types Reference](../../types.ts)
- [Core Plugins Examples](../../core/)
- [External Plugins](../)

## ✅ Checklist for Your Plugin

- [ ] Copied this folder with a new name
- [ ] Changed `id` in plugin.json
- [ ] Updated `name` and `description`
- [ ] Modified the component logic
- [ ] Tested in OpenChat
- [ ] Added error handling
- [ ] Documented your changes
- [ ] Removed unused code

## 🤝 Contributing

Want to share your plugin?

1. Test thoroughly
2. Add documentation
3. Create a Pull Request
4. Follow code style

## 📄 License

MIT License - feel free to use this template for your own plugins!

---

**Happy Plugin Development! 🎉**
