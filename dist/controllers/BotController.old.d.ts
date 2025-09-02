import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
export declare class BotController {
    private telegramService;
    private userActivityService;
    private contestService;
    constructor();
    handleChatJoinRequest(ctx: Context): Promise<void>;
    handleChatMemberUpdate(ctx: Context): Promise<void>;
    handleLeftChatMember(ctx: Context): Promise<void>;
    handleTiktokMessage(ctx: Context): Promise<void>;
    handleStartCommand(ctx: Context): Promise<void>;
    handleClassificaCommand(ctx: Context): Promise<void>;
    handleMyChatMember(ctx: Context): Promise<void>;
    handleTikTokCallback(ctx: Context): Promise<void>;
    getTelegramService(): TelegramService;
    getUserActivityService(): UserActivityService;
    handleHelpCommand(ctx: Context): Promise<void>;
    handleLinkCommand(ctx: Context): Promise<void>;
    handleGenerateClassificaCommand(ctx: Context): Promise<void>;
    private isAdmin;
    getContestService(): ContestService;
    private extractReferralCodeFromInviteLink;
}
//# sourceMappingURL=BotController.old.d.ts.map