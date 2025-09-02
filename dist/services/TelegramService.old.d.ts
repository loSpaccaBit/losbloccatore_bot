import { Telegraf } from 'telegraf';
import { GoodbyeMessageOptions } from '../types/index';
export declare class TelegramService {
    private bot;
    constructor();
    private setupErrorHandling;
    private escapeMarkdownSpecialChars;
    processMarkdownText(text: string): string;
    sendWelcomeWithTikTok(userId: number, userName: string, referralLink?: string): Promise<boolean>;
    sendWelcomeReturningUser(userId: number, userName: string, totalPoints: number, referralLink?: string): Promise<boolean>;
    sendTikTokPointsMessage(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean>;
    sendGoodbyeMessage(userId: number, userName: string, options?: GoodbyeMessageOptions): Promise<boolean>;
    approveChatJoinRequest(chatId: number, userId: number): Promise<boolean>;
    declineChatJoinRequest(chatId: number, userId: number): Promise<boolean>;
    getChatMemberCount(chatId: number): Promise<number | null>;
    getChatInfo(chatId: number): Promise<any>;
    createChannelInviteLink(chatId: number, referralCode: string): Promise<string | null>;
    getReferralInviteLink(referralCode: string): Promise<string | null>;
    private getGoodbyeMessage;
    sendPhoto(chatId: number, photoPath: string, caption?: string): Promise<boolean>;
    getBot(): Telegraf;
    startPolling(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=TelegramService.old.d.ts.map