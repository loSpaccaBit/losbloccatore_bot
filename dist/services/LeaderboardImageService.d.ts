export interface LeaderboardPosition {
    rank: number;
    username: string;
    points: number;
}
export declare class LeaderboardImageService {
    private static readonly MAIN_TEXT_CONFIG;
    private static readonly EMPTY_TEXT_CONFIG;
    private contestService;
    private templatePath;
    private outputPath;
    constructor();
    private getContestService;
    private applyTextStyle;
    generateLeaderboardImage(chatId: number): Promise<string>;
    private truncateText;
    getLeaderboardData(chatId: number, limit?: number): Promise<LeaderboardPosition[]>;
    getOutputPath(): string;
    getTemplatePath(): string;
    private generateEmptyLeaderboard;
}
//# sourceMappingURL=LeaderboardImageService.d.ts.map