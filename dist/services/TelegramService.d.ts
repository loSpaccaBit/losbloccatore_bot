import { Telegraf } from 'telegraf';
import { TelegramCoreService } from '../domains/telegram/TelegramCoreService';
import { TelegramMessageService } from '../domains/telegram/TelegramMessageService';
import { TelegramChatService } from '../domains/telegram/TelegramChatService';
import { TelegramInviteService } from '../domains/telegram/TelegramInviteService';
import { GoodbyeMessageOptions } from '../types';
export declare class TelegramService {
    private coreService;
    private messageService;
    private chatService;
    private inviteService;
    constructor();
    getBot(): Telegraf;
    startPolling(): Promise<void>;
    stop(): Promise<void>;
    isCurrentlyPolling(): boolean;
    getBotInfo(): Promise<any>;
    processMarkdownText(text: string): string;
    sendWelcomeWithTikTok(userId: number, userName: string, referralLink: string): Promise<boolean>;
    sendWelcomeReturningUser(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean>;
    sendTikTokPointsMessage(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean>;
    sendGoodbyeMessage(userId: number, userName: string, options?: GoodbyeMessageOptions): Promise<boolean>;
    sendPhoto(chatId: number, photoPath: string, caption?: string, options?: any): Promise<boolean>;
    approveChatJoinRequest(chatId: number, userId: number): Promise<boolean>;
    declineChatJoinRequest(chatId: number, userId: number): Promise<boolean>;
    getChatMemberCount(chatId: number): Promise<number>;
    getChatInfo(chatId: number): Promise<any | null>;
    getChatMember(chatId: number, userId: number): Promise<any | null>;
    isUserMemberOfChat(chatId: number, userId: number): Promise<boolean>;
    isUserAdminOfChat(chatId: number, userId: number): Promise<boolean>;
    createChannelInviteLink(chatId: number, name?: string, expireDate?: number, memberLimit?: number): Promise<string | null>;
    getReferralInviteLink(referralCode: string): Promise<string | null>;
    revokeInviteLink(chatId: number, inviteLink: string): Promise<boolean>;
    exportChatInviteLink(chatId: number): Promise<string | null>;
    getCoreService(): TelegramCoreService;
    getMessageService(): TelegramMessageService;
    getChatService(): TelegramChatService;
    getInviteService(): TelegramInviteService;
    healthCheck(): Promise<{
        overall: boolean;
        core: boolean;
        details: any;
    }>;
    getStats(): {
        isPolling: boolean;
        referralLinkStats: any;
        timestamp: string;
    };
}
//# sourceMappingURL=TelegramService.d.ts.map