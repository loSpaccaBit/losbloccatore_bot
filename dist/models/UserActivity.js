"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivity = void 0;
class UserActivity {
    constructor(data) {
        this.id = data.id || 0;
        this.userId = data.userId;
        this.username = data.username || undefined;
        this.firstName = data.firstName;
        this.lastName = data.lastName || undefined;
        this.action = data.action;
        this.chatId = data.chatId;
        this.chatTitle = data.chatTitle;
        this.metadata = data.metadata || undefined;
        this.timestamp = data.timestamp || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }
    get fullName() {
        return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
    }
    get displayName() {
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
exports.UserActivity = UserActivity;
//# sourceMappingURL=UserActivity.js.map