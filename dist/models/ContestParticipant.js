"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContestParticipant = void 0;
class ContestParticipant {
    constructor(data) {
        this.id = data.id || 0;
        this.userId = data.userId;
        this.username = data.username || undefined;
        this.firstName = data.firstName;
        this.lastName = data.lastName || undefined;
        this.chatId = data.chatId;
        this.points = data.points || 0;
        this.tiktokTaskCompleted = data.tiktokTaskCompleted || false;
        this.tiktokLinks = data.tiktokLinks || undefined;
        this.referralCode = data.referralCode;
        this.referredBy = data.referredBy || undefined;
        this.referralCount = data.referralCount || 0;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.joinedAt = data.joinedAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }
    get fullName() {
        return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
    }
    get displayName() {
        return this.username ? `@${this.username}` : this.fullName;
    }
    get parsedTiktokLinks() {
        if (!this.tiktokLinks)
            return [];
        try {
            return JSON.parse(this.tiktokLinks);
        }
        catch {
            return [];
        }
    }
    addTiktokLink(link) {
        const currentLinks = this.parsedTiktokLinks;
        if (!currentLinks.includes(link)) {
            currentLinks.push(link);
            this.tiktokLinks = JSON.stringify(currentLinks);
        }
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
            chatId: Number(this.chatId),
            points: this.points,
            tiktokTaskCompleted: this.tiktokTaskCompleted,
            tiktokLinks: this.parsedTiktokLinks,
            referralCode: this.referralCode,
            referredBy: this.referredBy ? Number(this.referredBy) : undefined,
            referralCount: this.referralCount,
            isActive: this.isActive,
            joinedAt: this.joinedAt,
            updatedAt: this.updatedAt
        };
    }
}
exports.ContestParticipant = ContestParticipant;
//# sourceMappingURL=ContestParticipant.js.map