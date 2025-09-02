import { ContestReferral as PrismaContestReferral, ReferralStatus } from '@prisma/client';
export type ContestReferralData = {
    id?: number;
    referrerId: bigint;
    referredUserId: bigint;
    chatId: bigint;
    status?: ReferralStatus;
    pointsAwarded?: number;
    createdAt?: Date;
    leftAt?: Date;
    metadata?: Record<string, any>;
};
export declare class ContestReferral {
    id: number;
    referrerId: bigint;
    referredUserId: bigint;
    chatId: bigint;
    status: ReferralStatus;
    pointsAwarded: number;
    createdAt: Date;
    leftAt?: Date | undefined;
    metadata?: Record<string, any> | undefined;
    constructor(data: PrismaContestReferral | ContestReferralData);
    toJSON(): {
        id: number;
        referrerId: number;
        referredUserId: number;
        chatId: number;
        status: import(".prisma/client").$Enums.ReferralStatus;
        pointsAwarded: number;
        createdAt: Date;
        leftAt: Date | undefined;
        metadata: Record<string, any> | undefined;
    };
}
export { ReferralStatus };
//# sourceMappingURL=ContestReferral.d.ts.map