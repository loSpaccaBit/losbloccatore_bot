import { Context } from 'telegraf';
import { UserActivityService } from '../services/UserActivityService';
export declare class AdminCommandHandler {
    private userActivityService;
    constructor(userActivityService: UserActivityService);
    handleGenerateClassificaCommand(ctx: Context): Promise<void>;
    handleHealthCommand(ctx: Context): Promise<void>;
    handleStatsCommand(ctx: Context): Promise<void>;
    handleCleanupCommand(ctx: Context): Promise<void>;
    private getSystemHealthInfo;
    private testDatabaseConnection;
    private getSystemStats;
    private performDataCleanup;
    private formatHealthMessage;
    private formatStatsMessage;
    private formatCleanupResults;
    private isAdmin;
    private handleAdminCommandError;
}
//# sourceMappingURL=AdminCommandHandler.d.ts.map