"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const logger_1 = __importDefault(require("../utils/logger"));
class MessageService {
    constructor() {
        this.messageCache = new Map();
        this.settingsCache = new Map();
        this.messagesDir = (0, path_1.join)(process.cwd(), 'messages');
    }
    static getInstance() {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    }
    async loadMessage(messageType, options = {}) {
        const cacheKey = `${messageType}_${JSON.stringify(options)}`;
        if (this.messageCache.has(cacheKey)) {
            logger_1.default.debug('Message loaded from cache', { messageType, cacheKey });
            return this.messageCache.get(cacheKey);
        }
        try {
            const filePath = (0, path_1.join)(this.messagesDir, `${messageType}.md`);
            let content = await (0, promises_1.readFile)(filePath, 'utf8');
            if (options.variables) {
                content = this.processVariables(content, options.variables);
            }
            content = content.replace(/<!--[\s\S]*?-->/g, '').trim();
            this.messageCache.set(cacheKey, content);
            logger_1.default.debug('Message loaded from file', {
                messageType,
                filePath,
                contentLength: content.length,
                variablesCount: options.variables ? Object.keys(options.variables).length : 0
            });
            return content;
        }
        catch (error) {
            logger_1.default.error('Failed to load message from file', error, {
                messageType,
                messagesDir: this.messagesDir
            });
            throw new Error(`Failed to load message: ${messageType}`);
        }
    }
    async getMessageMetadata(messageType, variables) {
        try {
            const filePath = (0, path_1.join)(this.messagesDir, `${messageType}.md`);
            let content = await (0, promises_1.readFile)(filePath, 'utf8');
            if (variables) {
                content = this.processVariables(content, variables);
            }
            const metadata = {};
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
        }
        catch (error) {
            logger_1.default.debug('No metadata found for message', { messageType });
            return {};
        }
    }
    async loadMessages(messageTypes, options = {}) {
        const results = new Map();
        const promises = messageTypes.map(async (messageType) => {
            try {
                const content = await this.loadMessage(messageType, options);
                results.set(messageType, content);
            }
            catch (error) {
                logger_1.default.warn('Failed to load message, skipping', { messageType, error: error.message });
            }
        });
        await Promise.all(promises);
        logger_1.default.debug('Batch message loading completed', {
            requested: messageTypes.length,
            loaded: results.size
        });
        return results;
    }
    processVariables(content, variables) {
        let processedContent = content;
        processedContent = this.processConditionalBlocks(processedContent, variables);
        Object.entries(variables).forEach(([key, value]) => {
            const patterns = [
                new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
                new RegExp(`\\{${key}\\}`, 'g'),
                new RegExp(`\\$${key}\\b`, 'g')
            ];
            patterns.forEach(pattern => {
                processedContent = processedContent.replace(pattern, String(value));
            });
        });
        return processedContent;
    }
    processConditionalBlocks(content, variables) {
        let processedContent = content;
        const positiveConditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
        processedContent = processedContent.replace(positiveConditionalRegex, (_match, key, blockContent) => {
            const value = variables[key];
            if (value && value !== '' && value !== 0 && typeof value !== 'undefined') {
                return blockContent.trim();
            }
            return '';
        });
        const negativeConditionalRegex = /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
        processedContent = processedContent.replace(negativeConditionalRegex, (_match, key, blockContent) => {
            const value = variables[key];
            if (!value || value === '' || value === 0 || typeof value === 'undefined') {
                return blockContent.trim();
            }
            return '';
        });
        return processedContent;
    }
    clearCache(messageType) {
        if (messageType) {
            const keysToDelete = Array.from(this.messageCache.keys())
                .filter(key => key.startsWith(`${messageType}_`));
            keysToDelete.forEach(key => this.messageCache.delete(key));
            logger_1.default.debug('Message cache cleared for message type', { messageType, clearedCount: keysToDelete.length });
        }
        else {
            this.messageCache.clear();
            logger_1.default.debug('All message cache cleared');
        }
    }
    async messageExists(messageType) {
        try {
            const filePath = (0, path_1.join)(this.messagesDir, `${messageType}.md`);
            await (0, promises_1.readFile)(filePath, 'utf8');
            return true;
        }
        catch {
            return false;
        }
    }
    async getAvailableMessages() {
        try {
            const { readdir } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const files = await readdir(this.messagesDir);
            return files
                .filter(file => file.endsWith('.md'))
                .map(file => file.replace('.md', ''));
        }
        catch (error) {
            logger_1.default.error('Failed to read messages directory', error, { messagesDir: this.messagesDir });
            return [];
        }
    }
    async loadSettings() {
        const cacheKey = 'settings';
        if (this.settingsCache.has(cacheKey)) {
            const cached = this.settingsCache.get(cacheKey);
            return JSON.parse(cached);
        }
        try {
            const filePath = (0, path_1.join)(this.messagesDir, 'settings.md');
            const content = await (0, promises_1.readFile)(filePath, 'utf8');
            const settings = {};
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
            this.settingsCache.set(cacheKey, JSON.stringify(settings));
            setTimeout(() => this.settingsCache.delete(cacheKey), 300000);
            logger_1.default.debug('Settings loaded from file', { settings });
            return settings;
        }
        catch (error) {
            logger_1.default.error('Failed to load settings', error);
            return {};
        }
    }
    async getSetting(key, defaultValue) {
        const settings = await this.loadSettings();
        return settings[key] || defaultValue || '';
    }
    getCacheStats() {
        return {
            size: this.messageCache.size,
            keys: Array.from(this.messageCache.keys()),
            settingsSize: this.settingsCache.size
        };
    }
}
exports.MessageService = MessageService;
exports.default = MessageService.getInstance();
//# sourceMappingURL=MessageService.js.map