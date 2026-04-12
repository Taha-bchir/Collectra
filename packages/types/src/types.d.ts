export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    __InternalSupabase: {
        PostgrestVersion: "14.1";
    };
    public: {
        Tables: {
            _prisma_migrations: {
                Row: {
                    applied_steps_count: number;
                    checksum: string;
                    finished_at: string | null;
                    id: string;
                    logs: string | null;
                    migration_name: string;
                    rolled_back_at: string | null;
                    started_at: string;
                };
                Insert: {
                    applied_steps_count?: number;
                    checksum: string;
                    finished_at?: string | null;
                    id: string;
                    logs?: string | null;
                    migration_name: string;
                    rolled_back_at?: string | null;
                    started_at?: string;
                };
                Update: {
                    applied_steps_count?: number;
                    checksum?: string;
                    finished_at?: string | null;
                    id?: string;
                    logs?: string | null;
                    migration_name?: string;
                    rolled_back_at?: string | null;
                    started_at?: string;
                };
                Relationships: [];
            };
            Campaign: {
                Row: {
                    createdAt: string;
                    description: string | null;
                    id: string;
                    name: string;
                    status: Database["public"]["Enums"]["CampaignStatus"];
                    updatedAt: string;
                    workspaceId: string;
                };
                Insert: {
                    createdAt?: string;
                    description?: string | null;
                    id: string;
                    name: string;
                    status?: Database["public"]["Enums"]["CampaignStatus"];
                    updatedAt: string;
                    workspaceId: string;
                };
                Update: {
                    createdAt?: string;
                    description?: string | null;
                    id?: string;
                    name?: string;
                    status?: Database["public"]["Enums"]["CampaignStatus"];
                    updatedAt?: string;
                    workspaceId?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Campaign_workspaceId_fkey";
                        columns: ["workspaceId"];
                        isOneToOne: false;
                        referencedRelation: "Workspace";
                        referencedColumns: ["id"];
                    }
                ];
            };
            Client: {
                Row: {
                    address: string | null;
                    createdAt: string;
                    email: string | null;
                    fullName: string;
                    id: string;
                    phone: string | null;
                    updatedAt: string;
                    workspaceId: string;
                };
                Insert: {
                    address?: string | null;
                    createdAt?: string;
                    email?: string | null;
                    fullName: string;
                    id: string;
                    phone?: string | null;
                    updatedAt: string;
                    workspaceId: string;
                };
                Update: {
                    address?: string | null;
                    createdAt?: string;
                    email?: string | null;
                    fullName?: string;
                    id?: string;
                    phone?: string | null;
                    updatedAt?: string;
                    workspaceId?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Client_workspaceId_fkey";
                        columns: ["workspaceId"];
                        isOneToOne: false;
                        referencedRelation: "Workspace";
                        referencedColumns: ["id"];
                    }
                ];
            };
            ClientToken: {
                Row: {
                    campaignId: string;
                    createdAt: string;
                    debtId: string;
                    expiresAt: string;
                    id: string;
                    token: string;
                };
                Insert: {
                    campaignId: string;
                    createdAt?: string;
                    debtId: string;
                    expiresAt?: string;
                    id: string;
                    token: string;
                };
                Update: {
                    campaignId?: string;
                    createdAt?: string;
                    debtId?: string;
                    expiresAt?: string;
                    id?: string;
                    token?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "ClientToken_campaignId_fkey";
                        columns: ["campaignId"];
                        isOneToOne: false;
                        referencedRelation: "Campaign";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "ClientToken_debtId_fkey";
                        columns: ["debtId"];
                        isOneToOne: false;
                        referencedRelation: "Debt";
                        referencedColumns: ["id"];
                    }
                ];
            };
            CustomerActionHistory: {
                Row: {
                    actionType: Database["public"]["Enums"]["ActionType"];
                    createdAt: string;
                    customerId: string;
                    debtId: string | null;
                    id: string;
                    metadata: Json | null;
                    performedBy: string | null;
                    timestamp: string;
                };
                Insert: {
                    actionType: Database["public"]["Enums"]["ActionType"];
                    createdAt?: string;
                    customerId: string;
                    debtId?: string | null;
                    id: string;
                    metadata?: Json | null;
                    performedBy?: string | null;
                    timestamp?: string;
                };
                Update: {
                    actionType?: Database["public"]["Enums"]["ActionType"];
                    createdAt?: string;
                    customerId?: string;
                    debtId?: string | null;
                    id?: string;
                    metadata?: Json | null;
                    performedBy?: string | null;
                    timestamp?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "CustomerActionHistory_customerId_fkey";
                        columns: ["customerId"];
                        isOneToOne: false;
                        referencedRelation: "Client";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "CustomerActionHistory_debtId_fkey";
                        columns: ["debtId"];
                        isOneToOne: false;
                        referencedRelation: "Debt";
                        referencedColumns: ["id"];
                    }
                ];
            };
            Debt: {
                Row: {
                    amount: number;
                    campaignId: string;
                    clientId: string;
                    createdAt: string;
                    dueDate: string;
                    id: string;
                    promiseDate: string | null;
                    status: Database["public"]["Enums"]["DebtStatus"];
                    updatedAt: string;
                };
                Insert: {
                    amount: number;
                    campaignId: string;
                    clientId: string;
                    createdAt?: string;
                    dueDate: string;
                    id: string;
                    promiseDate?: string | null;
                    status?: Database["public"]["Enums"]["DebtStatus"];
                    updatedAt: string;
                };
                Update: {
                    amount?: number;
                    campaignId?: string;
                    clientId?: string;
                    createdAt?: string;
                    dueDate?: string;
                    id?: string;
                    promiseDate?: string | null;
                    status?: Database["public"]["Enums"]["DebtStatus"];
                    updatedAt?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Debt_campaignId_fkey";
                        columns: ["campaignId"];
                        isOneToOne: false;
                        referencedRelation: "Campaign";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "Debt_clientId_fkey";
                        columns: ["clientId"];
                        isOneToOne: false;
                        referencedRelation: "Client";
                        referencedColumns: ["id"];
                    }
                ];
            };
            Invitation: {
                Row: {
                    campaignId: string;
                    createdAt: string;
                    email: string;
                    expiresAt: string;
                    id: string;
                    role: Database["public"]["Enums"]["WorkspaceRole"];
                    status: Database["public"]["Enums"]["InvitationStatus"];
                    token: string;
                };
                Insert: {
                    campaignId: string;
                    createdAt?: string;
                    email: string;
                    expiresAt: string;
                    id: string;
                    role?: Database["public"]["Enums"]["WorkspaceRole"];
                    status?: Database["public"]["Enums"]["InvitationStatus"];
                    token: string;
                };
                Update: {
                    campaignId?: string;
                    createdAt?: string;
                    email?: string;
                    expiresAt?: string;
                    id?: string;
                    role?: Database["public"]["Enums"]["WorkspaceRole"];
                    status?: Database["public"]["Enums"]["InvitationStatus"];
                    token?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Invitation_campaignId_fkey";
                        columns: ["campaignId"];
                        isOneToOne: false;
                        referencedRelation: "Campaign";
                        referencedColumns: ["id"];
                    }
                ];
            };
            PaymentPromise: {
                Row: {
                    createdAt: string;
                    debtId: string;
                    id: string;
                    promisedDate: string;
                    status: Database["public"]["Enums"]["PromiseStatus"];
                    updatedAt: string;
                };
                Insert: {
                    createdAt?: string;
                    debtId: string;
                    id: string;
                    promisedDate: string;
                    status?: Database["public"]["Enums"]["PromiseStatus"];
                    updatedAt: string;
                };
                Update: {
                    createdAt?: string;
                    debtId?: string;
                    id?: string;
                    promisedDate?: string;
                    status?: Database["public"]["Enums"]["PromiseStatus"];
                    updatedAt?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "PaymentPromise_debtId_fkey";
                        columns: ["debtId"];
                        isOneToOne: false;
                        referencedRelation: "Debt";
                        referencedColumns: ["id"];
                    }
                ];
            };
            User: {
                Row: {
                    createdAt: string;
                    email: string;
                    fullName: string | null;
                    id: string;
                    updatedAt: string;
                };
                Insert: {
                    createdAt?: string;
                    email: string;
                    fullName?: string | null;
                    id: string;
                    updatedAt: string;
                };
                Update: {
                    createdAt?: string;
                    email?: string;
                    fullName?: string | null;
                    id?: string;
                    updatedAt?: string;
                };
                Relationships: [];
            };
            Workspace: {
                Row: {
                    createdAt: string;
                    createdByUserId: string;
                    id: string;
                    name: string;
                    updatedAt: string;
                    website: string | null;
                };
                Insert: {
                    createdAt?: string;
                    createdByUserId: string;
                    id: string;
                    name: string;
                    updatedAt: string;
                    website?: string | null;
                };
                Update: {
                    createdAt?: string;
                    createdByUserId?: string;
                    id?: string;
                    name?: string;
                    updatedAt?: string;
                    website?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "Workspace_createdByUserId_fkey";
                        columns: ["createdByUserId"];
                        isOneToOne: false;
                        referencedRelation: "User";
                        referencedColumns: ["id"];
                    }
                ];
            };
            WorkspaceMember: {
                Row: {
                    joinedAt: string;
                    role: Database["public"]["Enums"]["WorkspaceRole"];
                    userId: string;
                    workspaceId: string;
                };
                Insert: {
                    joinedAt?: string;
                    role: Database["public"]["Enums"]["WorkspaceRole"];
                    userId: string;
                    workspaceId: string;
                };
                Update: {
                    joinedAt?: string;
                    role?: Database["public"]["Enums"]["WorkspaceRole"];
                    userId?: string;
                    workspaceId?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "WorkspaceMember_userId_fkey";
                        columns: ["userId"];
                        isOneToOne: false;
                        referencedRelation: "User";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "WorkspaceMember_workspaceId_fkey";
                        columns: ["workspaceId"];
                        isOneToOne: false;
                        referencedRelation: "Workspace";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            ActionType: "LINK_SENT" | "LINK_CLICKED" | "PROMISE_MADE" | "PROMISE_UPDATED" | "PAYMENT_CONFIRMED" | "STATUS_CHANGED" | "NOTE_ADDED" | "EMAIL_SENT" | "SMS_SENT" | "PHONE_CALL" | "OTHER";
            CampaignStatus: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
            DebtStatus: "IMPORTED" | "UNPAID" | "NOTIFIED" | "PROMISED" | "PAID" | "OVERDUE";
            InvitationStatus: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
            PromiseStatus: "ACTIVE" | "KEPT" | "BROKEN" | "CANCELLED";
            WorkspaceRole: "OWNER" | "AGENT";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export declare const Constants: {
    readonly public: {
        readonly Enums: {
            readonly ActionType: readonly ["LINK_SENT", "LINK_CLICKED", "PROMISE_MADE", "PROMISE_UPDATED", "PAYMENT_CONFIRMED", "STATUS_CHANGED", "NOTE_ADDED", "EMAIL_SENT", "SMS_SENT", "PHONE_CALL", "OTHER"];
            readonly CampaignStatus: readonly ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];
            readonly DebtStatus: readonly ["IMPORTED", "UNPAID", "NOTIFIED", "PROMISED", "PAID", "OVERDUE"];
            readonly InvitationStatus: readonly ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"];
            readonly PromiseStatus: readonly ["ACTIVE", "KEPT", "BROKEN", "CANCELLED"];
            readonly WorkspaceRole: readonly ["OWNER", "AGENT"];
        };
    };
};
export {};
//# sourceMappingURL=types.d.ts.map