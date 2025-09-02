import { UserActivity } from '../models/UserActivity';
import { TelegramUser, ChatJoinRequestEvent, ChatMemberUpdate } from '../types/index';
export declare class UserActivityService {
    private userActivityRepository;
    constructor();
    recordJoinRequest(event: ChatJoinRequestEvent): Promise<UserActivity>;
    recordApproval(userId: number, chatId: number, chatTitle: string, userInfo: Partial<TelegramUser>): Promise<UserActivity>;
    recordUserLeave(memberUpdate: ChatMemberUpdate): Promise<UserActivity>;
    recordRejection(userId: number, chatId: number, chatTitle: string, userInfo: Partial<TelegramUser>, reason?: string): Promise<UserActivity>;
    getUserHistory(userId: number, limit?: number): Promise<UserActivity[]>;
    getChatHistory(chatId: number, limit?: number): Promise<UserActivity[]>;
    getUserStats(userId: number): Promise<{
        totalActivities: number;
        joinCount: number;
        leaveCount: number;
        approvedCount: number;
        rejectedCount: number;
        lastActivity?: Date;
    }>;
    getChatStats(chatId: number): Promise<{
        totalActivities: number;
        uniqueUsers: number;
        joinCount: number;
        leaveCount: number;
        approvedCount: number;
        rejectedCount: number;
        lastActivity?: Date;
    }>;
    getRecentActivities(hours?: number, limit?: number): Promise<UserActivity[]>;
    cleanupOldActivities(daysOld?: number): Promise<number>;
    hasUserJoinedBefore(userId: number, chatId: number): Promise<boolean>;
    isUserCurrentlyInChat(userId: number, chatId: number): Promise<boolean>;
    getActivityCount(): Promise<number>;
    getRecentActivityCount(hours: number): Promise<number>;
    cleanupOldRecords(cutoffDate: Date): Promise<number>;
}
//# sourceMappingURL=UserActivityService.d.ts.map