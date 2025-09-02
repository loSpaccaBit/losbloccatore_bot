export interface MessageVariables {
    [key: string]: string | number | boolean;
}
export interface MessageOptions {
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    disableWebPagePreview?: boolean;
    variables?: MessageVariables;
    withPhoto?: string;
    caption?: string;
}
export declare class MessageService {
    private static instance;
    private messageCache;
    private settingsCache;
    private readonly messagesDir;
    constructor();
    static getInstance(): MessageService;
    loadMessage(messageType: string, options?: MessageOptions): Promise<string>;
    getMessageMetadata(messageType: string, variables?: MessageVariables): Promise<{
        [key: string]: string;
    }>;
    loadMessages(messageTypes: string[], options?: MessageOptions): Promise<Map<string, string>>;
    private processVariables;
    private processConditionalBlocks;
    clearCache(messageType?: string): void;
    messageExists(messageType: string): Promise<boolean>;
    getAvailableMessages(): Promise<string[]>;
    loadSettings(): Promise<{
        [key: string]: string;
    }>;
    getSetting(key: string, defaultValue?: string): Promise<string>;
    getCacheStats(): {
        size: number;
        keys: string[];
        settingsSize: number;
    };
}
declare const _default: MessageService;
export default _default;
//# sourceMappingURL=MessageService.d.ts.map