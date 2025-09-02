import { TelegramCoreService } from './TelegramCoreService';
import { GoodbyeMessageOptions } from '../../types';
export declare class TelegramMessageService {
    private coreService;
    constructor(coreService: TelegramCoreService);
    private escapeMarkdownSpecialChars;
    processMarkdownText(text: string): string;
    sendWelcomeWithTikTok(userId: number, userName: string, referralLink: string): Promise<boolean>;
    sendWelcomeReturningUser(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean>;
    sendTikTokPointsMessage(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean>;
    sendGoodbyeMessage(userId: number, userName: string, options?: GoodbyeMessageOptions): Promise<boolean>;
    private getGoodbyeMessage;
    sendPhoto(chatId: number, photoPath: string, caption?: string, options?: any): Promise<boolean>;
    private getTikTokUrl;
}
//# sourceMappingURL=TelegramMessageService.d.ts.map