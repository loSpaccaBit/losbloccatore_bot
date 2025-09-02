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

export class ContestReferral {
  id: number;
  referrerId: bigint;
  referredUserId: bigint;
  chatId: bigint;
  status: ReferralStatus;
  pointsAwarded: number;
  createdAt: Date;
  leftAt?: Date | undefined;
  metadata?: Record<string, any> | undefined;

  constructor(data: PrismaContestReferral | ContestReferralData) {
    this.id = data.id || 0;
    this.referrerId = data.referrerId;
    this.referredUserId = data.referredUserId;
    this.chatId = data.chatId;
    this.status = data.status || ReferralStatus.ACTIVE;
    this.pointsAwarded = data.pointsAwarded || 2;
    this.createdAt = data.createdAt || new Date();
    this.leftAt = data.leftAt || undefined;
    this.metadata = (data.metadata as Record<string, any>) || undefined;
  }

  toJSON() {
    return {
      id: this.id,
      referrerId: Number(this.referrerId),
      referredUserId: Number(this.referredUserId),
      chatId: Number(this.chatId),
      status: this.status,
      pointsAwarded: this.pointsAwarded,
      createdAt: this.createdAt,
      leftAt: this.leftAt,
      metadata: this.metadata
    };
  }
}

// Re-export the enum for convenience
export { ReferralStatus };