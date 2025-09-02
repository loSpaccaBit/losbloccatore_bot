import { UserAction } from '@prisma/client';
import { UserActivity, UserActivityData } from '../../models/UserActivity';
export declare class UserActivityRepository {
    private prisma;
    constructor();
    private getPrisma;
    create(activityData: UserActivityData): Promise<UserActivity>;
    findById(id: number): Promise<UserActivity | null>;
    findByUserId(userId: bigint, limit?: number): Promise<UserActivity[]>;
    findByChatId(chatId: bigint, limit?: number): Promise<UserActivity[]>;
    findByAction(action: UserAction, limit?: number): Promise<UserActivity[]>;
    findByDateRange(startDate: Date, endDate: Date): Promise<UserActivity[]>;
    getUserStats(userId: bigint): Promise<{
        totalActivities: number;
        joinCount: number;
        leaveCount: number;
        approvedCount: number;
        rejectedCount: number;
        lastActivity?: Date;
    }>;
    getChatStats(chatId: bigint): Promise<{
        totalActivities: number;
        uniqueUsers: number;
        joinCount: number;
        leaveCount: number;
        approvedCount: number;
        rejectedCount: number;
        lastActivity?: Date;
    }>;
    findRecent(userId: number, chatId: number, action: UserAction, withinMs: number): Promise<UserActivity | null>;
    getRecentActivities(hours?: number, limit?: number): Promise<UserActivity[]>;
    deleteOldActivities(daysOld?: number): Promise<number>;
    getTotalCount(): Promise<number>;
    getCountSince(date: Date): Promise<number>;
    deleteOlderThan(cutoffDate: Date): Promise<number>;
}
//# sourceMappingURL=UserActivityRepository.d.ts.map