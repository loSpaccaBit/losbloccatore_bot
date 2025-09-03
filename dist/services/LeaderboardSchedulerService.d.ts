export declare class LeaderboardSchedulerService {
    private isRunning;
    private scheduledTask;
    private chatId;
    private adminUserId;
    private cronExpression;
    private telegramService;
    private leaderboardImageService;
    constructor(chatId?: number, cronExpression?: string);
    private getTelegramService;
    private getLeaderboardImageService;
    start(): void;
    stop(): void;
    generateAndSendLeaderboard(): Promise<void>;
    sendLeaderboardNow(): Promise<void>;
    updateSchedule(cronExpression: string): void;
    updateChatId(chatId: number): void;
    getStatus(): {
        isRunning: boolean;
        chatId: number;
        cronExpression: string;
        adminUserId: number | null;
    };
    isActive(): boolean;
    startTestSchedule(): void;
}
declare const _default: LeaderboardSchedulerService;
export default _default;
//# sourceMappingURL=LeaderboardSchedulerService.d.ts.map