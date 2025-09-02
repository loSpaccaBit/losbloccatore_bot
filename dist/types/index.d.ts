export interface BotConfig {
    token: string;
    channelId: string;
    adminUserId?: number;
    environment: 'development' | 'production' | 'test';
    port: number;
    database: DatabaseConfig;
    logging: LoggingConfig;
    cache: CacheConfig;
}
export interface DatabaseConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    logging: boolean;
}
export interface LoggingConfig {
    level: 'error' | 'warn' | 'info' | 'debug';
    maxFiles: number;
    maxSize: string;
    datePattern: string;
}
export interface CacheConfig {
    ttl: number;
    maxKeys: number;
}
export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_bot: boolean;
}
export interface ChatJoinRequestEvent {
    user: TelegramUser;
    chat: {
        id: number;
        title: string;
        type: string;
    };
    date: number;
}
export interface ChatMemberUpdate {
    chat: {
        id: number;
        title: string;
        type: string;
    };
    from: TelegramUser;
    date: number;
    old_chat_member: ChatMember;
    new_chat_member: ChatMember;
}
export interface ChatMember {
    user: TelegramUser;
    status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
}
export declare enum UserAction {
    JOINED = "joined",
    LEFT = "left",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export interface UserActivity {
    id: number | undefined;
    userId: number;
    username: string | undefined;
    firstName: string;
    lastName: string | undefined;
    action: UserAction;
    chatId: number;
    chatTitle: string;
    timestamp: Date;
    metadata: Record<string, any> | undefined;
}
export interface GoodbyeMessageOptions {
    includeReturnMessage?: boolean;
    customMessage?: string;
}
//# sourceMappingURL=index.d.ts.map