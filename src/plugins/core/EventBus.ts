/**
 * Event Bus for Inter-Plugin Communication
 * 
 * Provides a publish-subscribe pattern for plugins to communicate with each other
 * and with the application without tight coupling.
 */

import type { EventListener } from './types'

export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map()

  /**
   * Subscribe to an event
   * @param event Event name
   * @param listener Callback function
   * @returns Unsubscribe function
   */
  on(event: string, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    
    this.listeners.get(event)!.add(listener)
    
    // Return unsubscribe function
    return () => this.off(event, listener)
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param listener Callback function to remove
   */
  off(event: string, listener: EventListener): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
      
      // Clean up empty listener sets
      if (listeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * Emit an event asynchronously
   * All listeners are called in parallel
   * @param event Event name
   * @param data Event data
   */
  async emit(event: string, data?: any): Promise<void> {
    const listeners = this.listeners.get(event)
    if (!listeners || listeners.size === 0) {
      return
    }
    
    // Execute all listeners in parallel
    const promises = Array.from(listeners).map(listener => {
      try {
        return Promise.resolve(listener(data))
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error)
        return Promise.resolve()
      }
    })
    
    await Promise.all(promises)
  }

  /**
   * Emit an event synchronously
   * Listeners are called sequentially
   * @param event Event name
   * @param data Event data
   */
  emitSync(event: string, data?: any): void {
    const listeners = this.listeners.get(event)
    if (!listeners || listeners.size === 0) {
      return
    }
    
    listeners.forEach(listener => {
      try {
        listener(data)
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error)
      }
    })
  }

  /**
   * Clear all listeners for an event, or all events if no event specified
   * @param event Optional event name to clear
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Get the number of listeners for an event
   * @param event Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }

  /**
   * Get all event names that have listeners
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * Check if an event has any listeners
   * @param event Event name
   * @returns True if event has listeners
   */
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0
  }
}
