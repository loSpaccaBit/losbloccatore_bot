import { UserActivity as PrismaUserActivity, UserAction } from '@prisma/client';
export type UserActivityData = {
    id?: number;
    userId: bigint;
    username?: string;
    firstName: string;
    lastName?: string;
    action: UserAction;
    chatId: bigint;
    chatTitle: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
    updatedAt?: Date;
};
export declare class UserActivity {
    id: number;
    userId: bigint;
    username?: string | undefined;
    firstName: string;
    lastName?: string | undefined;
    action: UserAction;
    chatId: bigint;
    chatTitle: string;
    metadata?: Record<string, any> | undefined;
    timestamp: Date;
    updatedAt: Date;
    constructor(data: PrismaUserActivity | UserActivityData);
    get fullName(): string;
    get displayName(): string;
    toJSON(): {
        id: number;
        userId: number;
        username: string | undefined;
        firstName: string;
        lastName: string | undefined;
        fullName: string;
        displayName: string;
        action: import(".prisma/client").$Enums.UserAction;
        chatId: number;
        chatTitle: string;
        metadata: Record<string, any> | undefined;
        timestamp: Date;
        updatedAt: Date;
    };
}
//# sourceMappingURL=UserActivity.d.ts.map