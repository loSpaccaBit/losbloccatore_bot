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

export class UserActivity {
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

  constructor(data: PrismaUserActivity | UserActivityData) {
    this.id = data.id || 0;
    this.userId = data.userId;
    this.username = data.username || undefined;
    this.firstName = data.firstName;
    this.lastName = data.lastName || undefined;
    this.action = data.action;
    this.chatId = data.chatId;
    this.chatTitle = data.chatTitle;
    this.metadata = (data.metadata as Record<string, any>) || undefined;
    this.timestamp = data.timestamp || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  get fullName(): string {
    return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
  }

  get displayName(): string {
    return this.username ? `@${this.username}` : this.fullName;
  }

  toJSON() {
    return {
      id: this.id,
      userId: Number(this.userId),
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      displayName: this.displayName,
      action: this.action,
      chatId: Number(this.chatId),
      chatTitle: this.chatTitle,
      metadata: this.metadata,
      timestamp: this.timestamp,
      updatedAt: this.updatedAt
    };
  }
}