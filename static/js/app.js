// Theme management - Always dark mode
class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        // Always set to dark theme
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Sidebar management
class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarDockToggle = document.getElementById('sidebarDockToggle');
        this.mainContent = document.getElementById('mainContent');
        this.init();
    }

    init() {
        // Load saved sidebar state
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            this.collapseSidebar();
        }

        // Add event listeners
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.sidebarDockToggle) {
            this.sidebarDockToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Handle responsive behavior
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        
        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    toggleSidebar() {
        if (this.sidebar.classList.contains('collapsed')) {
            this.expandSidebar();
        } else {
            this.collapseSidebar();
        }
    }

    collapseSidebar() {
        this.sidebar.classList.add('collapsed');
        this.mainContent.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'true');
        
        // Keep the same icon (angle-left)
        const icon = this.sidebarToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-angle-right';
    }

    expandSidebar() {
        this.sidebar.classList.remove('collapsed');
        this.mainContent.classList.remove('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'false');
        
        // Keep consistent icon
        const icon = this.sidebarToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-angle-left';
    }

    handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // On mobile, toggle is managed by CSS classes
            if (!this.sidebar.classList.contains('collapsed')) {
                this.sidebar.classList.add('collapsed');
                this.mainContent.classList.add('sidebar-collapsed');
            }
        }
        // Desktop toggle visibility is managed by CSS classes
    }

    handleOutsideClick(e) {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;

        const isClickInsideSidebar = this.sidebar.contains(e.target);
        const isClickOnToggle = this.sidebarToggle.contains(e.target);
        const isSidebarOpen = !this.sidebar.classList.contains('collapsed');

        if (isSidebarOpen && !isClickInsideSidebar && !isClickOnToggle) {
            this.collapseSidebar();
        }
    }
}

// Message input management
class MessageInputManager {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.messagesArea = document.getElementById('messagesArea');
        this.init();
    }

    init() {
        if (!this.messageInput) return;

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => this.autoResize());
        
        // Handle Enter key (send) and Shift+Enter (new line)
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Update send button state
        this.messageInput.addEventListener('input', () => this.updateSendButton());
        
        // Focus input on page load
        this.messageInput.focus();

        // Scroll to bottom on page load
        this.scrollToBottom();
    }

    autoResize() {
        // Reset height to calculate new height
        this.messageInput.style.height = 'auto';
        
        // Calculate new height based on content
        const newHeight = Math.min(this.messageInput.scrollHeight, window.innerHeight * 0.65);
        this.messageInput.style.height = newHeight + 'px';
        
        // Scroll to bottom if needed
        if (this.messageInput.scrollHeight > newHeight) {
            this.messageInput.scrollTop = this.messageInput.scrollHeight;
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = this.messageInput.closest('form');
            if (form && this.messageInput.value.trim()) {
                form.submit();
            }
        }
    }

    updateSendButton() {
        if (!this.sendBtn) return;
        
        const hasContent = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasContent;
        
        if (hasContent) {
            this.sendBtn.classList.add('active');
        } else {
            this.sendBtn.classList.remove('active');
        }
    }

    scrollToBottom() {
        if (this.messagesArea) {
            setTimeout(() => {
                this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
            }, 100);
        }
    }
}

// Conversation management
class ConversationManager {
    constructor() {
        this.init();
    }

    init() {
        // Add click handlers for conversation items
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleConversationClick(e));
        });
    }

    handleConversationClick(e) {
        // Prevent navigation if clicking on delete button
        if (e.target.closest('.btn-delete')) {
            return;
        }
        
        // Remove active class from all items
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to clicked item
        e.currentTarget.classList.add('active');
    }
}

// Flash message management
class FlashMessageManager {
    constructor() {
        this.init();
    }

    init() {
        // Auto-dismiss flash messages after 5 seconds
        document.querySelectorAll('.alert').forEach(alert => {
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.classList.remove('show');
                    setTimeout(() => {
                        if (alert.parentNode) {
                            alert.remove();
                        }
                    }, 300);
                }
            }, 5000);
        });
    }
}

// Utility functions
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Newline to BR filter (similar to Jinja2 nl2br)
function nl2br(text) {
    return text.replace(/\n/g, '<br>');
}

// Initialize all managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    new SidebarManager();
    new MessageInputManager();
    new ConversationManager();
    new FlashMessageManager();
    
    // Add smooth scrolling behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    
    console.log('ChatGPT Interface initialized successfully');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Focus input when page becomes visible
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            setTimeout(() => messageInput.focus(), 100);
        }
    }
});

// Prevent form submission with empty messages
document.addEventListener('submit', (e) => {
    if (e.target.classList.contains('chat-form')) {
        const messageInput = e.target.querySelector('[name="message"]');
        if (messageInput && !messageInput.value.trim()) {
            e.preventDefault();
            messageInput.focus();
        }
    }
});
