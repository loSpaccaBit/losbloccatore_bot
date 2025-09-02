"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralStatus = exports.ContestReferral = void 0;
const client_1 = require("@prisma/client");
Object.defineProperty(exports, "ReferralStatus", { enumerable: true, get: function () { return client_1.ReferralStatus; } });
class ContestReferral {
    constructor(data) {
        this.id = data.id || 0;
        this.referrerId = data.referrerId;
        this.referredUserId = data.referredUserId;
        this.chatId = data.chatId;
        this.status = data.status || client_1.ReferralStatus.ACTIVE;
        this.pointsAwarded = data.pointsAwarded || 2;
        this.createdAt = data.createdAt || new Date();
        this.leftAt = data.leftAt || undefined;
        this.metadata = data.metadata || undefined;
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
exports.ContestReferral = ContestReferral;
//# sourceMappingURL=ContestReferral.js.map