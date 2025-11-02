import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { Globe, Paperclip, X } from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { cn } from '../lib/utils'
import { ImageProcessor } from '../lib/imageProcessor'
import { useToast } from '../hooks/useToast'
import type { ProviderConfig, ModelInfo, ImageAttachment } from '../types'

interface ChatInputProps {
  onSend: (message: string, images?: ImageAttachment[]) => void
  disabled?: boolean
  isGenerating?: boolean
  centered?: boolean
  providers?: ProviderConfig[]
  selectedProvider?: ProviderConfig | null
  selectedModel?: string
  models?: ModelInfo[]
  onSelectProvider?: (provider: ProviderConfig) => void
  onSelectModel?: (model: string) => void
  onLoadModels?: (provider: ProviderConfig) => void
  isLoadingModels?: boolean
  autoSearchEnabled?: boolean
  onToggleAutoSearch?: () => void
  modelCapabilities?: ModelInfo['capabilities']
  onCapabilitiesChange?: (capabilities: ModelInfo['capabilities']) => void
}

export function ChatInput({
  onSend,
  disabled,
  isGenerating,
  centered = false,
  providers = [],
  selectedProvider = null,
  selectedModel = '',
  models = [],
  onSelectProvider = () => { },
  onSelectModel = () => { },
  onLoadModels = () => { },
  isLoadingModels = false,
  autoSearchEnabled = false,
  onToggleAutoSearch = () => { },
  modelCapabilities,
  onCapabilitiesChange
}: ChatInputProps) {
  // Load input and images from localStorage on mount
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem('chat-input-draft') || ''
    } catch {
      return ''
    }
  })

  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>(() => {
    try {
      const saved = localStorage.getItem('chat-input-images')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showError, showInfo } = useToast()

  // Save input to localStorage whenever it changes
  useEffect(() => {
    try {
      if (input) {
        localStorage.setItem('chat-input-draft', input)
      } else {
        localStorage.removeItem('chat-input-draft')
      }
    } catch (error) {
      console.error('Failed to save input draft:', error)
    }
  }, [input])

  // Save attached images to localStorage whenever they change
  useEffect(() => {
    try {
      if (attachedImages.length > 0) {
        localStorage.setItem('chat-input-images', JSON.stringify(attachedImages))
      } else {
        localStorage.removeItem('chat-input-images')
      }
    } catch (error) {
      console.error('Failed to save attached images:', error)
    }
  }, [attachedImages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent sending images to non-vision models
    if (attachedImages.length > 0 && !modelCapabilities?.vision) {
      showError('Cannot send images with the selected model. Please select a vision-capable model.')
      return
    }

    if (input.trim() && !disabled) {
      onSend(input.trim(), attachedImages.length > 0 ? attachedImages : undefined)
      setInput('')
      setAttachedImages([])

      // Clear localStorage drafts after sending
      try {
        localStorage.removeItem('chat-input-draft')
        localStorage.removeItem('chat-input-images')
      } catch (error) {
        console.error('Failed to clear input drafts:', error)
      }

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // Auto-remove images when switching to non-vision model
  useEffect(() => {
    if (attachedImages.length > 0 && !modelCapabilities?.vision) {
      // Clean up object URLs before removing
      attachedImages.forEach(img => {
        if (img.url) {
          URL.revokeObjectURL(img.url)
        }
      })
      setAttachedImages([])
      showInfo('Images removed: Selected model does not support vision')
    }
  }, [modelCapabilities?.vision, attachedImages, showInfo])

  const handleAttachmentClick = () => {
    if (!modelCapabilities?.vision) {
      showError('Selected model does not support image attachments. Please select a vision-capable model.')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processFiles(files)
  }

  const handleRemoveImage = (imageId: string) => {
    setAttachedImages(prev => {
      const updated = prev.filter(img => img.id !== imageId)
      // Revoke object URL to free memory
      const removed = prev.find(img => img.id === imageId)
      if (removed?.url) {
        URL.revokeObjectURL(removed.url)
      }
      return updated
    })
  }

  // Process files from various sources (file input, paste, drag & drop)
  const processFiles = async (files: FileList | File[]) => {
    if (!modelCapabilities?.vision) {
      showError('Selected model does not support image attachments. Please select a vision-capable model.')
      setUploadStatus('Error: Model does not support images')
      return
    }

    const fileArray = Array.from(files)
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      showError('No valid image files found')
      setUploadStatus('Error: No valid image files')
      return
    }

    setIsProcessingImage(true)
    setUploadStatus(`Processing ${imageFiles.length} image(s)...`)

    try {
      const newImages: ImageAttachment[] = []
      let errorCount = 0

      for (const file of imageFiles) {
        try {
          const attachment = await ImageProcessor.processImage(file)
          newImages.push(attachment)
        } catch (err) {
          errorCount++
          console.error('Image processing error:', err)
        }
      }

      if (newImages.length > 0) {
        setAttachedImages(prev => [...prev, ...newImages])
        const successMessage = errorCount > 0
          ? `${newImages.length} image(s) attached successfully, ${errorCount} failed`
          : `${newImages.length} image(s) attached successfully`
        setUploadStatus(successMessage)
        if (errorCount > 0) {
          showInfo(successMessage)
        }
      } else if (errorCount > 0) {
        const errorMessage = `Failed to process ${errorCount} image(s)`
        showError(errorMessage)
        setUploadStatus(`Error: ${errorMessage}`)
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred while processing images'
      showError(errorMessage)
      setUploadStatus(`Error: ${errorMessage}`)
      console.error('Unexpected error in processFiles:', err)
    } finally {
      setIsProcessingImage(false)
      // Clear status after 3 seconds
      setTimeout(() => setUploadStatus(''), 3000)
    }
  }

  // Handle paste events (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault()
      await processFiles(files)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      await processFiles(files)
    }
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachedImages.forEach(img => {
        if (img.url) {
          URL.revokeObjectURL(img.url)
        }
      })
    }
  }, [])

  const isVisionSupported = modelCapabilities?.vision ?? false

  return (
    <div className={centered ? '' : 'pb-6 px-4'}>
      <div className={centered ? 'w-full' : 'max-w-3xl mx-auto'}>
        {/* Screen reader announcements for upload status */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {uploadStatus}
        </div>

        {/* Modern Island Container */}
        <div
          className="rounded-3xl shadow-lg"
          style={{ backgroundColor: '#2C2C2E', overflow: 'visible' }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <form onSubmit={handleSubmit}>
            {/* Image Previews */}
            {attachedImages.length > 0 && (
              <div
                className="px-6 pt-4 pb-2 flex flex-wrap gap-2"
                role="list"
                aria-label={`${attachedImages.length} image(s) attached`}
              >
                {attachedImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative group rounded-lg overflow-hidden"
                    style={{ backgroundColor: '#1A1A1C' }}
                    role="listitem"
                  >
                    <img
                      src={image.url}
                      alt={`Attached image: ${image.fileName}`}
                      className="h-20 w-20 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRemoveImage(image.id)
                        }
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
                      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                      title={`Remove ${image.fileName}`}
                      aria-label={`Remove attached image ${image.fileName}`}
                    >
                      <X className="w-3 h-3" style={{ color: '#FFFFFF' }} aria-hidden="true" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', color: '#FFFFFF' }}>
                      {image.fileName}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message..."
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full resize-none bg-transparent px-6 pb-2 rounded-t-3xl',
                attachedImages.length > 0 ? 'pt-2' : 'pt-4',
                'text-sm placeholder:text-muted-foreground',
                'focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'max-h-[200px] overflow-y-auto'
              )}
              style={{ color: 'var(--color-foreground)' }}
            />

            {/* Bottom Section with Web Search Toggle, Attachment, Model Selector and Send Button */}
            <div className="px-4 pb-3 flex items-center justify-between gap-2">
              {/* Left Side: Web Search Toggle and Attachment */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleAutoSearch}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 hover:bg-white/10"
                  title={autoSearchEnabled ? 'Web search enabled' : 'Web search disabled'}
                  aria-label={autoSearchEnabled ? 'Disable web search' : 'Enable web search'}
                >
                  <Globe
                    className="w-4 h-4 transition-colors"
                    style={{
                      color: autoSearchEnabled ? 'rgb(59, 130, 246)' : '#8E8E93',
                      strokeWidth: 2
                    }}
                  />
                </button>

                {/* Attachment Button */}
                <button
                  type="button"
                  onClick={handleAttachmentClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleAttachmentClick()
                    }
                  }}
                  disabled={!isVisionSupported || isProcessingImage}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    !isVisionSupported
                      ? 'Image attachments require a vision-capable model'
                      : isProcessingImage
                        ? 'Processing image...'
                        : attachedImages.length > 0
                          ? `${attachedImages.length} image(s) attached`
                          : 'Attach image'
                  }
                  aria-label={
                    !isVisionSupported
                      ? 'Attach image - requires vision-capable model'
                      : isProcessingImage
                        ? 'Processing image, please wait'
                        : attachedImages.length > 0
                          ? `Attach image - ${attachedImages.length} image(s) currently attached`
                          : 'Attach image'
                  }
                  aria-disabled={!isVisionSupported || isProcessingImage}
                >
                  <Paperclip
                    className="w-4 h-4 transition-colors"
                    style={{
                      color: attachedImages.length > 0 ? 'rgb(59, 130, 246)' : isVisionSupported ? '#8E8E93' : '#565656',
                      strokeWidth: 2
                    }}
                    aria-hidden="true"
                  />
                </button>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Select image files to attach"
                  tabIndex={-1}
                />
              </div>

              {/* Right Side: Model Selector and Send Button */}
              <div className="flex items-center gap-2">
                {/* Model Selector */}
                {providers.length > 0 && (
                  <ModelSelector
                    providers={providers}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    models={models}
                    onSelectProvider={onSelectProvider}
                    onSelectModel={onSelectModel}
                    onLoadModels={onLoadModels}
                    isLoadingModels={isLoadingModels}
                    openUpwards={!centered}
                    onCapabilitiesChange={onCapabilitiesChange}
                  />
                )}

                {/* Send/Stop Button */}
                <button
                  type="submit"
                  disabled={!input.trim() || disabled || isGenerating}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                  style={{
                    backgroundColor: input.trim() && !disabled && !isGenerating ? '#FFFFFF' : '#1A1A1C',
                    cursor: input.trim() && !disabled && !isGenerating ? 'pointer' : 'not-allowed'
                  }}
                  title="Send message"
                  aria-label="Send message"
                >
                  <FontAwesomeIcon
                    icon={faArrowUp}
                    className="w-4 h-4"
                    style={{
                      color: input.trim() && !disabled && !isGenerating ? '#000000' : '#565656'
                    }}
                  />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
