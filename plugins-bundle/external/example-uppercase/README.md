# Uppercase Example Plugin

This is an example plugin that demonstrates how to create a message processor plugin for OpenChat.

## What it does

This plugin converts all outgoing messages to UPPERCASE before sending them to the AI.

## How to use

1. Enable the plugin in Settings → Plugins → External Plugins
2. Type a message and send it
3. The message will be converted to uppercase before being sent to the AI

## Code

See `index.js` for the implementation.

## Creating your own plugin

Use this as a template to create your own plugins. You can:

- Modify the `processOutgoing` method to transform messages before sending
- Add a `processIncoming` method to transform AI responses
- Change the plugin type to create different kinds of plugins

For full documentation, see the main plugins README.
