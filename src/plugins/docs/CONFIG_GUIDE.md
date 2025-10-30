# Plugin Configuration Guide

This guide explains how to add configuration options to your plugins.

## Overview

Plugins can define configuration options in their `plugin.json` manifest. The Plugin API automatically generates a configuration UI based on the schema you define.

## Defining Configuration Schema

Add a `config` object to your `plugin.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A plugin with configuration",
  "author": "Your Name",
  "type": "ui-extension",
  "appVersion": "1.0.0",
  "config": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "description": "Your API key for the service",
      "default": ""
    },
    "maxResults": {
      "type": "number",
      "label": "Maximum Results",
      "description": "Maximum number of results to return",
      "default": 10,
      "min": 1,
      "max": 100,
      "step": 1
    },
    "enabled": {
      "type": "boolean",
      "label": "Enable Feature",
      "description": "Turn this feature on or off",
      "default": true
    },
    "theme": {
      "type": "select",
      "label": "Theme",
      "description": "Choose a color theme",
      "default": "dark",
      "options": ["light", "dark", "auto"]
    }
  }
}
```

## Supported Field Types

### String

```json
{
  "fieldName": {
    "type": "string",
    "label": "Field Label",
    "description": "Optional description",
    "default": "default value"
  }
}
```

### Number

For numbers with min/max, a slider is automatically used:

```json
{
  "fieldName": {
    "type": "number",
    "label": "Field Label",
    "description": "Optional description",
    "default": 50,
    "min": 0,
    "max": 100,
    "step": 5
  }
}
```

For numbers without min/max, a number input is used:

```json
{
  "fieldName": {
    "type": "number",
    "label": "Field Label",
    "description": "Optional description",
    "default": 42
  }
}
```

### Boolean

```json
{
  "fieldName": {
    "type": "boolean",
    "label": "Field Label",
    "description": "Optional description",
    "default": true
  }
}
```

### Select (Dropdown)

```json
{
  "fieldName": {
    "type": "select",
    "label": "Field Label",
    "description": "Optional description",
    "default": "option1",
    "options": ["option1", "option2", "option3"]
  }
}
```

## Accessing Configuration in Your Plugin

Use the `pluginAPI.config` object to access configuration values:

```typescript
class MyPlugin {
  onLoad() {
    // Get a config value
    const apiKey = pluginAPI.config.get('apiKey', '')
    const maxResults = pluginAPI.config.get('maxResults', 10)
    const enabled = pluginAPI.config.get('enabled', true)
    const theme = pluginAPI.config.get('theme', 'dark')
    
    console.log('Config:', { apiKey, maxResults, enabled, theme })
    
    // Get all config values
    const allConfig = pluginAPI.config.getAll()
    console.log('All config:', allConfig)
  }
  
  // Called when user changes configuration
  onConfigChange(config) {
    console.log('Config changed:', config)
    
    // React to config changes
    const enabled = config.enabled
    if (enabled) {
      this.enableFeature()
    } else {
      this.disableFeature()
    }
  }
  
  enableFeature() {
    // Your code here
  }
  
  disableFeature() {
    // Your code here
  }
}

export default MyPlugin
```

## Configuration API Methods

### `pluginAPI.config.get(key, defaultValue)`

Get a configuration value:

```typescript
const value = pluginAPI.config.get('apiKey', '')
```

### `pluginAPI.config.set(key, value)`

Set a configuration value (usually not needed, as users set config via UI):

```typescript
pluginAPI.config.set('apiKey', 'new-key')
```

### `pluginAPI.config.getAll()`

Get all configuration values:

```typescript
const config = pluginAPI.config.getAll()
```

### `pluginAPI.config.reset(key)`

Reset a config value to its default:

```typescript
pluginAPI.config.reset('apiKey')
```

### `pluginAPI.config.resetAll()`

Reset all config values to defaults:

```typescript
pluginAPI.config.resetAll()
```

## Validation

The Plugin API automatically validates configuration values based on your schema:

- **Type validation**: Ensures values match the specified type
- **Range validation**: For numbers, ensures values are within min/max bounds
- **Options validation**: For select fields, ensures values are in the options list

If validation fails, the user will see an error message and cannot save the configuration.

## Example: Complete Plugin with Configuration

```typescript
// plugin.json
{
  "id": "weather-plugin",
  "name": "Weather Display",
  "version": "1.0.0",
  "description": "Shows weather information",
  "author": "Your Name",
  "type": "ui-extension",
  "appVersion": "1.0.0",
  "config": {
    "apiKey": {
      "type": "string",
      "label": "OpenWeather API Key",
      "description": "Get your free API key from openweathermap.org",
      "default": ""
    },
    "units": {
      "type": "select",
      "label": "Temperature Units",
      "description": "Choose temperature units",
      "default": "metric",
      "options": ["metric", "imperial", "kelvin"]
    },
    "refreshInterval": {
      "type": "number",
      "label": "Refresh Interval (minutes)",
      "description": "How often to update weather data",
      "default": 30,
      "min": 5,
      "max": 120,
      "step": 5
    },
    "showIcon": {
      "type": "boolean",
      "label": "Show Weather Icon",
      "description": "Display weather condition icon",
      "default": true
    }
  }
}

// index.ts
class WeatherPlugin {
  private intervalId = null
  
  onLoad() {
    const apiKey = pluginAPI.config.get('apiKey', '')
    
    if (!apiKey) {
      pluginAPI.ui.showNotification(
        'Please configure your OpenWeather API key in plugin settings',
        'warning'
      )
      return
    }
    
    this.startWeatherUpdates()
  }
  
  onUnload() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }
  
  onConfigChange(config) {
    // Restart with new config
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    
    if (config.apiKey) {
      this.startWeatherUpdates()
    }
  }
  
  startWeatherUpdates() {
    const refreshInterval = pluginAPI.config.get('refreshInterval', 30)
    
    // Update immediately
    this.updateWeather()
    
    // Then update on interval
    this.intervalId = setInterval(() => {
      this.updateWeather()
    }, refreshInterval * 60 * 1000)
  }
  
  async updateWeather() {
    const apiKey = pluginAPI.config.get('apiKey', '')
    const units = pluginAPI.config.get('units', 'metric')
    
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=London&units=${units}&appid=${apiKey}`
      )
      const data = await response.json()
      
      console.log('Weather updated:', data)
      
      // Display weather in UI
      this.displayWeather(data)
    } catch (error) {
      console.error('Failed to fetch weather:', error)
    }
  }
  
  displayWeather(data) {
    const showIcon = pluginAPI.config.get('showIcon', true)
    const units = pluginAPI.config.get('units', 'metric')
    
    const temp = data.main.temp
    const unitSymbol = units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K'
    
    let message = `Temperature: ${temp}${unitSymbol}`
    
    if (showIcon) {
      message = `${data.weather[0].icon} ${message}`
    }
    
    pluginAPI.ui.showNotification(message, 'info')
  }
}

export default WeatherPlugin
```

## Best Practices

1. **Provide sensible defaults**: Always include default values so the plugin works out of the box
2. **Add descriptions**: Help users understand what each option does
3. **Use appropriate types**: Choose the right field type for better UX (e.g., slider for ranges)
4. **Validate in code**: Even though the UI validates, add validation in your plugin code too
5. **React to changes**: Implement `onConfigChange()` to respond to configuration updates
6. **Store sensitive data carefully**: Remember that config is stored in localStorage

## Configuration Storage

Configuration is automatically stored in localStorage with the key:
```
oc.plugin.config.{pluginId}
```

You don't need to handle storage yourself - the Plugin API does it for you!
