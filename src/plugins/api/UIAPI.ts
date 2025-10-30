/**
 * UI API
 * 
 * Provides UI interaction methods for plugins.
 * Allows plugins to show notifications, modals, and add UI elements.
 */

import React from 'react'

/**
 * Notification type
 */
export type NotificationType = 'info' | 'success' | 'error' | 'warning'

/**
 * Toolbar button definition
 */
export interface ToolbarButton {
  id: string
  label: string
  icon?: string
  tooltip?: string
  onClick: () => void
}

/**
 * UI state manager (singleton)
 * This will be connected to the actual UI components
 */
class UIStateManager {
  private static instance: UIStateManager
  private notificationHandler?: (message: string, type: NotificationType) => void
  private modalHandler?: (component: React.ComponentType | null) => void
  private toolbarButtons: Map<string, ToolbarButton> = new Map()

  private constructor() {}

  static getInstance(): UIStateManager {
    if (!UIStateManager.instance) {
      UIStateManager.instance = new UIStateManager()
    }
    return UIStateManager.instance
  }

  setNotificationHandler(handler: (message: string, type: NotificationType) => void): void {
    this.notificationHandler = handler
  }

  setModalHandler(handler: (component: React.ComponentType | null) => void): void {
    this.modalHandler = handler
  }

  showNotification(message: string, type: NotificationType): void {
    if (this.notificationHandler) {
      this.notificationHandler(message, type)
    } else {
      // Fallback to console
      console.log(`[${type.toUpperCase()}] ${message}`)
    }
  }

  showModal(component: React.ComponentType): void {
    if (this.modalHandler) {
      this.modalHandler(component)
    } else {
      console.warn('[UIAPI] Modal handler not set')
    }
  }

  hideModal(): void {
    if (this.modalHandler) {
      this.modalHandler(null)
    }
  }

  addToolbarButton(button: ToolbarButton): void {
    this.toolbarButtons.set(button.id, button)
  }

  removeToolbarButton(id: string): void {
    this.toolbarButtons.delete(id)
  }

  getToolbarButtons(): ToolbarButton[] {
    return Array.from(this.toolbarButtons.values())
  }
}

export const uiStateManager = UIStateManager.getInstance()

/**
 * UI API for plugins
 */
export class UIAPI {
  private pluginId: string
  private toolbarButtonIds: Set<string> = new Set()

  constructor(pluginId: string) {
    this.pluginId = pluginId
  }

  /**
   * Show a notification to the user
   * 
   * @param message - Notification message
   * @param type - Notification type (default: 'info')
   * 
   * @example
   * ```typescript
   * pluginAPI.ui.showNotification('Plugin loaded!', 'success')
   * pluginAPI.ui.showNotification('An error occurred', 'error')
   * ```
   */
  showNotification(message: string, type: NotificationType = 'info'): void {
    if (!message || typeof message !== 'string') {
      throw new Error(`[${this.pluginId}] Notification message must be a non-empty string`)
    }

    const validTypes: NotificationType[] = ['info', 'success', 'error', 'warning']
    if (!validTypes.includes(type)) {
      throw new Error(`[${this.pluginId}] Invalid notification type: ${type}`)
    }

    try {
      uiStateManager.showNotification(message, type)
      console.log(`[UIAPI] Plugin "${this.pluginId}" showed notification: ${message}`)
    } catch (error) {
      console.error(`[UIAPI] Failed to show notification for plugin ${this.pluginId}:`, error)
    }
  }

  /**
   * Show a modal dialog
   * 
   * @param component - React component to render in the modal
   * 
   * @example
   * ```typescript
   * pluginAPI.ui.showModal(() => (
   *   <div>
   *     <h2>My Plugin Modal</h2>
   *     <p>Custom content here</p>
   *   </div>
   * ))
   * ```
   */
  showModal(component: React.ComponentType): void {
    if (!component || typeof component !== 'function') {
      throw new Error(`[${this.pluginId}] Modal component must be a React component`)
    }

    try {
      uiStateManager.showModal(component)
      console.log(`[UIAPI] Plugin "${this.pluginId}" showed modal`)
    } catch (error) {
      console.error(`[UIAPI] Failed to show modal for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to show modal: ${error}`)
    }
  }

  /**
   * Hide the currently displayed modal
   * 
   * @example
   * ```typescript
   * pluginAPI.ui.hideModal()
   * ```
   */
  hideModal(): void {
    try {
      uiStateManager.hideModal()
      console.log(`[UIAPI] Plugin "${this.pluginId}" hid modal`)
    } catch (error) {
      console.error(`[UIAPI] Failed to hide modal for plugin ${this.pluginId}:`, error)
    }
  }

  /**
   * Add a button to the toolbar
   * 
   * @param button - Toolbar button definition
   * 
   * @example
   * ```typescript
   * pluginAPI.ui.addToolbarButton({
   *   id: 'my-button',
   *   label: 'My Action',
   *   icon: '🔧',
   *   tooltip: 'Click to do something',
   *   onClick: () => {
   *     console.log('Button clicked!')
   *   }
   * })
   * ```
   */
  addToolbarButton(button: ToolbarButton): void {
    this.validateToolbarButton(button)

    try {
      // Prefix button ID with plugin ID to avoid conflicts
      const prefixedButton: ToolbarButton = {
        ...button,
        id: `${this.pluginId}.${button.id}`
      }

      uiStateManager.addToolbarButton(prefixedButton)
      this.toolbarButtonIds.add(prefixedButton.id)
      
      console.log(`[UIAPI] Plugin "${this.pluginId}" added toolbar button: ${button.id}`)
    } catch (error) {
      console.error(`[UIAPI] Failed to add toolbar button for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to add toolbar button: ${error}`)
    }
  }

  /**
   * Remove a toolbar button
   * 
   * @param id - Button ID (without plugin prefix)
   * 
   * @example
   * ```typescript
   * pluginAPI.ui.removeToolbarButton('my-button')
   * ```
   */
  removeToolbarButton(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error(`[${this.pluginId}] Button ID must be a non-empty string`)
    }

    try {
      const prefixedId = `${this.pluginId}.${id}`
      uiStateManager.removeToolbarButton(prefixedId)
      this.toolbarButtonIds.delete(prefixedId)
      
      console.log(`[UIAPI] Plugin "${this.pluginId}" removed toolbar button: ${id}`)
    } catch (error) {
      console.error(`[UIAPI] Failed to remove toolbar button for plugin ${this.pluginId}:`, error)
    }
  }

  /**
   * Remove all toolbar buttons added by this plugin
   * Called automatically when plugin is unloaded
   * 
   * @internal
   */
  removeAllToolbarButtons(): void {
    try {
      this.toolbarButtonIds.forEach(id => {
        uiStateManager.removeToolbarButton(id)
      })
      this.toolbarButtonIds.clear()
      
      console.log(`[UIAPI] Plugin "${this.pluginId}" removed all toolbar buttons`)
    } catch (error) {
      console.error(`[UIAPI] Failed to remove toolbar buttons for plugin ${this.pluginId}:`, error)
    }
  }

  /**
   * Validate toolbar button definition
   */
  private validateToolbarButton(button: ToolbarButton): void {
    if (!button || typeof button !== 'object') {
      throw new Error(`[${this.pluginId}] Toolbar button must be an object`)
    }

    if (!button.id || typeof button.id !== 'string') {
      throw new Error(`[${this.pluginId}] Toolbar button must have a valid ID`)
    }

    if (!button.label || typeof button.label !== 'string') {
      throw new Error(`[${this.pluginId}] Toolbar button must have a valid label`)
    }

    if (!button.onClick || typeof button.onClick !== 'function') {
      throw new Error(`[${this.pluginId}] Toolbar button must have an onClick handler`)
    }
  }
}
