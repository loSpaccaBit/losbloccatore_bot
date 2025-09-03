import { Context } from 'telegraf';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
export declare class AdminCommandHandler {
    private userActivityService;
    private contestService;
    private leaderboardImageService;
    private telegramService;
    constructor(userActivityService: UserActivityService, contestService: ContestService);
    private getLeaderboardImageService;
    private getTelegramService;
    handleGenerateClassificaCommand(ctx: Context): Promise<void>;
    handleHealthCommand(ctx: Context): Promise<void>;
    handleStatsCommand(ctx: Context): Promise<void>;
    handleContestCommand(ctx: Context): Promise<void>;
    handleCleanupCommand(ctx: Context): Promise<void>;
    private getContestStats;
    private getSystemHealthInfo;
    private testDatabaseConnection;
    private getSystemStats;
    private performDataCleanup;
    private formatHealthMessage;
    private formatStatsMessage;
    private formatCleanupResults;
    private formatContestMessage;
    private isAdmin;
    private handleAdminCommandError;
}
//# sourceMappingURL=AdminCommandHandler.d.ts.map