/**
 * Plugin Security Manager
 * 
 * Handles plugin permissions, validation, and security checks.
 * Ensures external plugins cannot perform unauthorized actions.
 */

import type { Permission, PluginMetadata } from './types'

export class PluginSecurity {
  private grantedPermissions: Map<string, Set<Permission>> = new Map()
  private approvedPlugins: Set<string> = new Set()

  constructor() {
    this.loadPermissions()
    this.loadApprovals()
  }

  /**
   * Check if a plugin has a specific permission
   * @param pluginId Plugin ID
   * @param permission Permission to check
   * @returns True if permission is granted
   */
  hasPermission(pluginId: string, permission: Permission): boolean {
    const permissions = this.grantedPermissions.get(pluginId)
    return permissions?.has(permission) ?? false
  }

  /**
   * Request permission from user
   * @param pluginId Plugin ID
   * @param pluginName Plugin name (for display)
   * @param permission Permission to request
   * @returns Promise resolving to true if granted
   */
  async requestPermission(
    pluginId: string,
    pluginName: string,
    permission: Permission
  ): Promise<boolean> {
    // Check if already granted
    if (this.hasPermission(pluginId, permission)) {
      return true
    }

    // Show permission dialog
    const granted = await this.showPermissionDialog(pluginName, permission)
    
    if (granted) {
      this.grantPermission(pluginId, permission)
    }
    
    return granted
  }

  /**
   * Grant a permission to a plugin
   * @param pluginId Plugin ID
   * @param permission Permission to grant
   */
  private grantPermission(pluginId: string, permission: Permission): void {
    if (!this.grantedPermissions.has(pluginId)) {
      this.grantedPermissions.set(pluginId, new Set())
    }
    
    this.grantedPermissions.get(pluginId)!.add(permission)
    this.savePermissions()
  }

  /**
   * Revoke a permission from a plugin
   * @param pluginId Plugin ID
   * @param permission Permission to revoke
   */
  revokePermission(pluginId: string, permission: Permission): void {
    const permissions = this.grantedPermissions.get(pluginId)
    if (permissions) {
      permissions.delete(permission)
      
      // Remove empty permission sets
      if (permissions.size === 0) {
        this.grantedPermissions.delete(pluginId)
      }
      
      this.savePermissions()
    }
  }

  /**
   * Revoke all permissions from a plugin
   * @param pluginId Plugin ID
   */
  revokeAllPermissions(pluginId: string): void {
    this.grantedPermissions.delete(pluginId)
    this.savePermissions()
  }

  /**
   * Get all permissions granted to a plugin
   * @param pluginId Plugin ID
   * @returns Array of permissions
   */
  getPermissions(pluginId: string): Permission[] {
    const permissions = this.grantedPermissions.get(pluginId)
    return permissions ? Array.from(permissions) : []
  }

  /**
   * Validate plugin before loading
   * @param metadata Plugin metadata
   * @returns True if plugin can be loaded
   */
  validatePlugin(metadata: PluginMetadata): boolean {
    // Built-in plugins are always trusted
    if (metadata.isBuiltin) {
      return true
    }
    
    // External plugins need user approval
    return this.isPluginApproved(metadata.id)
  }

  /**
   * Check if user has approved an external plugin
   * @param pluginId Plugin ID
   * @returns True if approved
   */
  isPluginApproved(pluginId: string): boolean {
    return this.approvedPlugins.has(pluginId)
  }

  /**
   * Mark a plugin as approved by user
   * @param pluginId Plugin ID
   */
  approvePlugin(pluginId: string): void {
    this.approvedPlugins.add(pluginId)
    this.saveApprovals()
  }

  /**
   * Revoke approval for a plugin
   * @param pluginId Plugin ID
   */
  revokeApproval(pluginId: string): void {
    this.approvedPlugins.delete(pluginId)
    this.saveApprovals()
  }

  /**
   * Request user approval for an external plugin
   * @param pluginName Plugin name
   * @param pluginId Plugin ID
   * @returns Promise resolving to true if approved
   */
  async requestApproval(pluginName: string, pluginId: string): Promise<boolean> {
    const message = `Do you want to enable the external plugin "${pluginName}"?\n\n` +
      `External plugins can access your data and modify the application. ` +
      `Only enable plugins from trusted sources.`
    
    const approved = confirm(message)
    
    if (approved) {
      this.approvePlugin(pluginId)
    }
    
    return approved
  }

  /**
   * Show permission request dialog
   * @param pluginName Plugin name
   * @param permission Permission being requested
   * @returns Promise resolving to true if granted
   */
  private async showPermissionDialog(
    pluginName: string,
    permission: Permission
  ): Promise<boolean> {
    const permissionDescriptions: Record<Permission, string> = {
      network: 'access network resources and make HTTP requests',
      storage: 'read and write persistent data',
      filesystem: 'access files on your computer',
      clipboard: 'read and write clipboard data',
      notifications: 'show system notifications',
      'system-commands': 'execute system commands'
    }
    
    const description = permissionDescriptions[permission] || permission
    
    const message = `Plugin "${pluginName}" requests permission to:\n\n` +
      `${description}\n\n` +
      `Do you want to grant this permission?`
    
    return confirm(message)
  }

  /**
   * Load permissions from localStorage
   */
  private loadPermissions(): void {
    try {
      const stored = localStorage.getItem('oc.plugin.permissions')
      if (stored) {
        const data = JSON.parse(stored) as Record<string, Permission[]>
        this.grantedPermissions = new Map(
          Object.entries(data).map(([id, perms]) => [id, new Set(perms)])
        )
      }
    } catch (error) {
      console.error('Failed to load plugin permissions:', error)
    }
  }

  /**
   * Save permissions to localStorage
   */
  private savePermissions(): void {
    try {
      const data: Record<string, Permission[]> = {}
      this.grantedPermissions.forEach((perms, id) => {
        data[id] = Array.from(perms)
      })
      localStorage.setItem('oc.plugin.permissions', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save plugin permissions:', error)
    }
  }

  /**
   * Load plugin approvals from localStorage
   */
  private loadApprovals(): void {
    try {
      const stored = localStorage.getItem('oc.plugin.approvals')
      if (stored) {
        const data = JSON.parse(stored) as string[]
        this.approvedPlugins = new Set(data)
      }
    } catch (error) {
      console.error('Failed to load plugin approvals:', error)
    }
  }

  /**
   * Save plugin approvals to localStorage
   */
  private saveApprovals(): void {
    try {
      const data = Array.from(this.approvedPlugins)
      localStorage.setItem('oc.plugin.approvals', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save plugin approvals:', error)
    }
  }

  /**
   * Clear all security data (for testing/reset)
   */
  clearAll(): void {
    this.grantedPermissions.clear()
    this.approvedPlugins.clear()
    localStorage.removeItem('oc.plugin.permissions')
    localStorage.removeItem('oc.plugin.approvals')
  }
}
