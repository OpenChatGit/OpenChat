/**
 * Utility functions for detecting vision and reasoning capabilities in AI models
 */

/**
 * Checks if a model name indicates reasoning support
 * This function uses pattern matching on model names to detect reasoning capabilities
 */
export function hasReasoningCapability(modelName: string): boolean {
  const name = modelName.toLowerCase();
  
  // OpenAI reasoning models (o1, o3 series)
  if (name.startsWith('o1')) return true;
  if (name.startsWith('o3')) return true;
  if (name.includes('o1-preview')) return true;
  if (name.includes('o1-mini')) return true;
  if (name.includes('o3-mini')) return true;
  
  // DeepSeek reasoning models
  if (name.includes('deepseek-r1')) return true;
  if (name.includes('deepseek') && name.includes('r1')) return true;
  if (name.includes('deepseek-reasoner')) return true;
  
  // QwQ and Qwen reasoning models (Alibaba)
  if (name.includes('qwq')) return true;
  if (name.includes('qwen') && name.includes('qwq')) return true;
  // Qwen3 models have reasoning capabilities
  if (name.includes('qwen3')) return true;
  if (name.includes('qwen-3')) return true;
  
  // Marco-o1 (Alibaba)
  if (name.includes('marco-o1')) return true;
  
  // Kimi-k1 (Moonshot AI)
  if (name.includes('kimi-k1')) return true;
  if (name.includes('kimi') && name.includes('k1')) return true;
  
  // Gemini reasoning models
  if (name.includes('gemini') && name.includes('thinking')) return true;
  if (name.includes('gemini-2.0-flash-thinking')) return true;
  
  // Generic reasoning indicators
  if (name.includes('reasoning')) return true;
  if (name.includes('-think')) return true;
  if (name.includes('thinking')) return true;
  if (name.includes('cot')) return true; // Chain of Thought
  if (name.includes('reasoner')) return true;
  
  return false;
}

/**
 * Checks if a model name indicates vision support
 * This function uses pattern matching on model names to detect vision capabilities
 */
export function hasVisionCapability(modelName: string): boolean {
  const name = modelName.toLowerCase();
  
  // OpenAI vision models
  if (name.includes('gpt-4o')) return true;
  if (name.includes('gpt-4-turbo')) return true;
  if (name === 'gpt-4-vision-preview') return true;
  if (name === 'chatgpt-4o-latest') return true;
  
  // Anthropic Claude 3+ models (all support vision)
  if (name.includes('claude-3')) return true;
  
  // Ollama vision models
  if (name.includes('llava')) return true;
  if (name.includes('bakllava')) return true;
  if (name.includes('llama3.2-vision')) return true;
  if (name.includes('llama-3.2-vision')) return true;
  if (name.includes('minicpm-v')) return true;
  if (name.includes('moondream')) return true;
  
  // Google Gemini models
  if (name.includes('gemini') && name.includes('vision')) return true;
  if (name.includes('gemini-pro-vision')) return true;
  if (name.includes('gemini-1.5')) return true;
  if (name.includes('gemini-2.0')) return true;
  
  // Qwen vision models
  if (name.includes('qwen') && name.includes('vl')) return true;
  if (name.includes('qwen-vl')) return true;
  if (name.includes('qwen2-vl')) return true;
  
  // Other vision models
  if (name.includes('pixtral')) return true;
  if (name.includes('vision')) return true;
  if (name.includes('visual')) return true;
  if (name.includes('multimodal')) return true;
  if (name.includes('cogvlm')) return true;
  if (name.includes('internvl')) return true;
  if (name.includes('yi-vl')) return true;
  
  return false;
}

/**
 * Gets the maximum image size for a specific provider
 */
export function getMaxImageSize(providerType: string): number {
  switch (providerType) {
    case 'anthropic':
      return 5 * 1024 * 1024; // 5MB
    case 'openai':
      return 20 * 1024 * 1024; // 20MB
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp':
    default:
      return 20 * 1024 * 1024; // 20MB default
  }
}

/**
 * Gets the maximum number of images per message for a specific provider
 */
export function getMaxImages(providerType: string): number {
  switch (providerType) {
    case 'anthropic':
      return 20;
    case 'openai':
      return 10;
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp':
    default:
      return 10;
  }
}

/**
 * Creates vision capabilities object for a model
 */
export function createVisionCapabilities(modelName: string, providerType: string) {
  if (!hasVisionCapability(modelName)) {
    return undefined;
  }
  
  return {
    vision: true,
    maxImageSize: getMaxImageSize(providerType),
    maxImages: getMaxImages(providerType),
  };
}

/**
 * Creates complete capabilities object for a model (vision + reasoning)
 */
export function createModelCapabilities(modelName: string, providerType: string) {
  const hasVision = hasVisionCapability(modelName);
  const hasReasoning = hasReasoningCapability(modelName);
  
  if (!hasVision && !hasReasoning) {
    return undefined;
  }
  
  return {
    vision: hasVision ? true : undefined,
    maxImageSize: hasVision ? getMaxImageSize(providerType) : undefined,
    maxImages: hasVision ? getMaxImages(providerType) : undefined,
    reasoning: hasReasoning ? true : undefined,
  };
}
