import { ImageAttachment } from '../types';

export interface ImageProcessingOptions {
  maxSizeBytes?: number; // Default: 20MB
  maxWidth?: number; // Default: 2048px
  maxHeight?: number; // Default: 2048px
  quality?: number; // Default: 0.9 (for JPEG)
  supportedFormats?: string[]; // Default: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}

const DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
  maxSizeBytes: 20 * 1024 * 1024, // 20MB
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.9,
  supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

export class ImageProcessor {
  /**
   * Validates an image file against supported formats and size limits
   */
  static async validateImage(
    file: File,
    options: ImageProcessingOptions = {}
  ): Promise<{ valid: boolean; error?: string }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Check file type
    if (!opts.supportedFormats.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported image format. Please use JPEG, PNG, GIF, or WebP.`
      };
    }

    // Check file size
    if (file.size > opts.maxSizeBytes) {
      const maxSizeMB = opts.maxSizeBytes / (1024 * 1024);
      return {
        valid: false,
        error: `Image is too large. Maximum size is ${maxSizeMB}MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Converts a file to Base64 encoded string
   */
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const result = reader.result as string;
          if (!result) {
            reject(new Error('Failed to read file: No data returned'));
            return;
          }
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = result.split(',')[1];
          if (!base64) {
            reject(new Error('Failed to encode image: Invalid data format'));
            return;
          }
          resolve(base64);
        } catch (err) {
          reject(new Error('Failed to process image data'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file: File reading error'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Gets the dimensions of an image file
   */
  static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let url: string | null = null;
      
      try {
        url = URL.createObjectURL(file);
      } catch (err) {
        reject(new Error('Failed to create image URL'));
        return;
      }

      img.onload = () => {
        if (url) URL.revokeObjectURL(url);
        if (img.width === 0 || img.height === 0) {
          reject(new Error('Invalid image dimensions'));
          return;
        }
        resolve({
          width: img.width,
          height: img.height
        });
      };

      img.onerror = () => {
        if (url) URL.revokeObjectURL(url);
        reject(new Error('Failed to load image: The file may be corrupted or not a valid image'));
      };

      img.src = url;
    });
  }

  /**
   * Resizes an image if it exceeds the maximum dimensions
   */
  static async resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality: number = 0.9
  ): Promise<Blob> {
    const dimensions = await this.getImageDimensions(file);
    const { width, height } = dimensions;

    // Check if resizing is needed
    if (width <= maxWidth && height <= maxHeight) {
      return file;
    }

    // Calculate new dimensions while maintaining aspect ratio
    let newWidth = width;
    let newHeight = height;

    if (width > maxWidth) {
      newWidth = maxWidth;
      newHeight = (height * maxWidth) / width;
    }

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = (width * maxHeight) / height;
    }

    // Create canvas and resize
    return new Promise((resolve, reject) => {
      const img = new Image();
      let url: string | null = null;
      
      try {
        url = URL.createObjectURL(file);
      } catch (err) {
        reject(new Error('Failed to create image URL for resizing'));
        return;
      }

      img.onload = () => {
        if (url) URL.revokeObjectURL(url);

        try {
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context for resizing'));
            return;
          }

          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to resize image: Could not create output'));
              }
            },
            file.type,
            quality
          );
        } catch (err) {
          reject(new Error('Failed to resize image: Processing error'));
        }
      };

      img.onerror = () => {
        if (url) URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for resizing'));
      };

      img.src = url;
    });
  }

  /**
   * Processes an image file: validates, resizes if needed, encodes to Base64,
   * and creates an ImageAttachment object with all metadata
   */
  static async processImage(
    file: File,
    options: ImageProcessingOptions = {}
  ): Promise<ImageAttachment> {
    try {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      // Validate the image
      const validation = await this.validateImage(file, opts);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get original dimensions
      const dimensions = await this.getImageDimensions(file);

      // Resize if needed
      let processedFile: File | Blob = file;
      if (dimensions.width > opts.maxWidth || dimensions.height > opts.maxHeight) {
        processedFile = await this.resizeImage(
          file,
          opts.maxWidth,
          opts.maxHeight,
          opts.quality
        );
      }

      // Convert to Base64
      const base64Data = await this.fileToBase64(
        processedFile instanceof File ? processedFile : new File([processedFile], file.name, { type: file.type })
      );

      // Get final dimensions (after potential resize)
      const finalDimensions = processedFile === file
        ? dimensions
        : await this.getImageDimensions(
            new File([processedFile], file.name, { type: file.type })
          );

      // Create object URL for display
      const url = URL.createObjectURL(processedFile);

      // Create ImageAttachment object
      const attachment: ImageAttachment = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        data: base64Data,
        mimeType: file.type,
        fileName: file.name,
        size: processedFile.size,
        width: finalDimensions.width,
        height: finalDimensions.height,
        url
      };

      return attachment;
    } catch (err) {
      // Wrap any unexpected errors with a user-friendly message
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to process image: An unexpected error occurred');
    }
  }
}
