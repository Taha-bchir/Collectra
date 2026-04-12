export const Constants = {
    public: {
        Enums: {
            ActionType: [
                "LINK_SENT",
                "LINK_CLICKED",
                "PROMISE_MADE",
                "PROMISE_UPDATED",
                "PAYMENT_CONFIRMED",
                "STATUS_CHANGED",
                "NOTE_ADDED",
                "EMAIL_SENT",
                "SMS_SENT",
                "PHONE_CALL",
                "OTHER",
            ],
            CampaignStatus: ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"],
            DebtStatus: ["IMPORTED", "UNPAID", "NOTIFIED", "PROMISED", "PAID", "OVERDUE"],
            InvitationStatus: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
            PromiseStatus: ["ACTIVE", "KEPT", "BROKEN", "CANCELLED"],
            WorkspaceRole: ["OWNER", "AGENT"],
        },
    },
};
