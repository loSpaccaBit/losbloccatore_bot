import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { ContestService } from '../services/ContestService';
export declare class TikTokTaskHandler {
    private telegramService;
    private contestService;
    constructor(telegramService: TelegramService, contestService: ContestService);
    handleTiktokMessage(ctx: Context): Promise<void>;
    handleTikTokCallback(ctx: Context): Promise<void>;
    private processTikTokPointsCallback;
    private isTimingRequirementMet;
    private completeTikTokTask;
    private sendTikTokSuccessMessage;
    private sendFallbackTikTokMessage;
    private handleTikTokCallbackError;
    hasUserCompletedTikTokTask(userId: number): Promise<boolean>;
    getTikTokTaskStats(userId: number): Promise<{
        completed: boolean;
        pointsEarned: number;
        completionDate?: Date;
    } | null>;
}
//# sourceMappingURL=TikTokTaskHandler.d.ts.map