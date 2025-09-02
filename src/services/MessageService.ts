import { readFile } from 'fs/promises';
import { join } from 'path';
import logger from '../utils/logger';

export interface MessageVariables {
  [key: string]: string | number | boolean;
}

export interface MessageOptions {
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableWebPagePreview?: boolean;
  variables?: MessageVariables;
  withPhoto?: string; // Path to local photo file
  caption?: string; // Caption for photo
}

export class MessageService {
  private static instance: MessageService;
  private messageCache = new Map<string, string>();
  private settingsCache = new Map<string, string>();
  private readonly messagesDir: string;

  constructor() {
    this.messagesDir = join(process.cwd(), 'messages');
  }

  static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService();
    }
    return MessageService.instance;
  }

  /**
   * Load a message from a markdown file
   * @param messageType The type/name of the message file (without .md extension)
   * @param options Configuration options for the message
   * @returns The processed message content and metadata
   */
  async loadMessage(messageType: string, options: MessageOptions = {}): Promise<string> {
    const cacheKey = `${messageType}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.messageCache.has(cacheKey)) {
      logger.debug('Message loaded from cache', { messageType, cacheKey });
      return this.messageCache.get(cacheKey)!;
    }

    try {
      const filePath = join(this.messagesDir, `${messageType}.md`);
      let content = await readFile(filePath, 'utf8');

      // Process variables if provided
      if (options.variables) {
        content = this.processVariables(content, options.variables);
      }

      // Remove HTML comments from final content
      content = content.replace(/<!--[\s\S]*?-->/g, '').trim();

      // Cache the processed content
      this.messageCache.set(cacheKey, content);
      
      logger.debug('Message loaded from file', { 
        messageType, 
        filePath, 
        contentLength: content.length,
        variablesCount: options.variables ? Object.keys(options.variables).length : 0
      });

      return content;
      
    } catch (error) {
      logger.error('Failed to load message from file', error as Error, { 
        messageType, 
        messagesDir: this.messagesDir 
      });
      throw new Error(`Failed to load message: ${messageType}`);
    }
  }

  /**
   * Extract metadata from message file (IMAGE, AUDIO, etc.)
   * @param messageType The message type
   * @param variables Optional variables to process in metadata
   * @returns Object with metadata
   */
  async getMessageMetadata(messageType: string, variables?: MessageVariables): Promise<{ [key: string]: string }> {
    try {
      const filePath = join(this.messagesDir, `${messageType}.md`);
      let content = await readFile(filePath, 'utf8');
      
      // Process variables in content first if provided
      if (variables) {
        content = this.processVariables(content, variables);
      }
      
      const metadata: { [key: string]: string } = {};
      
      // Extract metadata from HTML comments  
      const commentRegex = /<!--\s*([\s\S]*?)\s*-->/;
      const match = content.match(commentRegex);
      
      if (match) {
        const metadataBlock = match[1];
        const lines = metadataBlock.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim();
            metadata[key.trim()] = value;
          }
        });
      }

      return metadata;
      
    } catch (error) {
      logger.debug('No metadata found for message', { messageType });
      return {};
    }
  }

  /**
   * Load multiple messages at once
   * @param messageTypes Array of message types to load
   * @param options Common options to apply to all messages
   * @returns Map of messageType -> content
   */
  async loadMessages(
    messageTypes: string[], 
    options: MessageOptions = {}
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    const promises = messageTypes.map(async (messageType) => {
      try {
        const content = await this.loadMessage(messageType, options);
        results.set(messageType, content);
      } catch (error) {
        logger.warn('Failed to load message, skipping', { messageType, error: (error as Error).message });
      }
    });

    await Promise.all(promises);
    
    logger.debug('Batch message loading completed', { 
      requested: messageTypes.length, 
      loaded: results.size 
    });

    return results;
  }

  /**
   * Process template variables in message content
   * @param content The message content with variables
   * @param variables Object containing variable values
   * @returns Content with variables replaced
   */
  private processVariables(content: string, variables: MessageVariables): string {
    let processedContent = content;

    // First, handle conditional blocks
    processedContent = this.processConditionalBlocks(processedContent, variables);

    // Then, replace simple variables
    Object.entries(variables).forEach(([key, value]) => {
      // Support multiple variable formats: {{key}}, {key}, $key
      const patterns = [
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),  // {{key}}
        new RegExp(`\\{${key}\\}`, 'g'),        // {key}
        new RegExp(`\\$${key}\\b`, 'g')         // $key
      ];

      patterns.forEach(pattern => {
        processedContent = processedContent.replace(pattern, String(value));
      });
    });

    return processedContent;
  }

  /**
   * Process conditional blocks in mustache-like syntax
   * @param content The content with conditional blocks
   * @param variables The variables to check
   * @returns Content with conditional blocks processed
   */
  private processConditionalBlocks(content: string, variables: MessageVariables): string {
    let processedContent = content;

    // Process positive conditionals {{#key}}...{{/key}}
    const positiveConditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    processedContent = processedContent.replace(positiveConditionalRegex, (_match, key, blockContent) => {
      const value = variables[key];
      // Show block if value exists and is truthy
      if (value && value !== '' && value !== 0 && typeof value !== 'undefined') {
        return blockContent.trim();
      }
      return '';
    });

    // Process negative conditionals {{^key}}...{{/key}}
    const negativeConditionalRegex = /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    processedContent = processedContent.replace(negativeConditionalRegex, (_match, key, blockContent) => {
      const value = variables[key];
      // Show block if value doesn't exist or is falsy
      if (!value || value === '' || value === 0 || typeof value === 'undefined') {
        return blockContent.trim();
      }
      return '';
    });

    return processedContent;
  }

  /**
   * Clear message cache
   * @param messageType Optional specific message type to clear, or all if not specified
   */
  clearCache(messageType?: string): void {
    if (messageType) {
      // Clear all cached versions of this message type
      const keysToDelete = Array.from(this.messageCache.keys())
        .filter(key => key.startsWith(`${messageType}_`));
      
      keysToDelete.forEach(key => this.messageCache.delete(key));
      
      logger.debug('Message cache cleared for message type', { messageType, clearedCount: keysToDelete.length });
    } else {
      this.messageCache.clear();
      logger.debug('All message cache cleared');
    }
  }

  /**
   * Check if a message file exists
   * @param messageType The message type to check
   * @returns Promise<boolean>
   */
  async messageExists(messageType: string): Promise<boolean> {
    try {
      const filePath = join(this.messagesDir, `${messageType}.md`);
      await readFile(filePath, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all available message types
   * @returns Array of message type names (without .md extension)
   */
  async getAvailableMessages(): Promise<string[]> {
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.messagesDir);
      
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''));
        
    } catch (error) {
      logger.error('Failed to read messages directory', error as Error, { messagesDir: this.messagesDir });
      return [];
    }
  }

  /**
   * Load settings from settings.md file
   * @returns Object with parsed settings
   */
  async loadSettings(): Promise<{ [key: string]: string }> {
    const cacheKey = 'settings';
    
    if (this.settingsCache.has(cacheKey)) {
      const cached = this.settingsCache.get(cacheKey)!;
      return JSON.parse(cached);
    }

    try {
      const filePath = join(this.messagesDir, 'settings.md');
      const content = await readFile(filePath, 'utf8');
      
      const settings: { [key: string]: string } = {};
      
      // Extract settings from HTML comments
      const settingRegex = /<!--\s*([\s\S]*?)\s*-->/;
      const match = content.match(settingRegex);
      
      if (match) {
        const settingsBlock = match[1];
        const lines = settingsBlock.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim();
            settings[key.trim()] = value;
          }
        });
      }

      // Cache for 5 minutes
      this.settingsCache.set(cacheKey, JSON.stringify(settings));
      setTimeout(() => this.settingsCache.delete(cacheKey), 300000);
      
      logger.debug('Settings loaded from file', { settings });
      
      return settings;
      
    } catch (error) {
      logger.error('Failed to load settings', error as Error);
      return {};
    }
  }

  /**
   * Get a specific setting value
   * @param key Setting key
   * @param defaultValue Default value if setting not found
   * @returns Setting value
   */
  async getSetting(key: string, defaultValue?: string): Promise<string> {
    const settings = await this.loadSettings();
    return settings[key] || defaultValue || '';
  }

  /**
   * Get cache statistics
   * @returns Object with cache stats
   */
  getCacheStats(): { size: number; keys: string[]; settingsSize: number } {
    return {
      size: this.messageCache.size,
      keys: Array.from(this.messageCache.keys()),
      settingsSize: this.settingsCache.size
    };
  }
}

export default MessageService.getInstance();