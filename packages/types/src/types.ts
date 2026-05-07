export type UserRow = {
  id: string
  email: string
  fullName: string | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceRow = {
  id: string
  name: string
  website: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type WorkspaceMemberRow = {
  userId: string
  workspaceId: string
  role: 'OWNER' | 'MANAGER' | 'AGENT'
  status: 'ACTIVE' | 'INACTIVE'
  joinedAt: string
}

export type WorkspaceInvitationRow = {
  id: string
  workspaceId: string
  invitedByUserId: string
  email: string
  role: 'OWNER' | 'MANAGER' | 'AGENT'
  token: string
  expiresAt: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  createdAt: string
}

export type CampaignRow = {
  id: string
  workspaceId: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

export type ClientRow = {
  id: string
  workspaceId: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export type DebtRecordRow = {
  id: string
  campaignId: string
  clientId: string
  amount: string
  dueDate: string
  status: 'IMPORTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'
  promiseDate: string | null
  pendingStripeSessionId: string | null
  invoiceNumber: string | null
  createdAt: string
  updatedAt: string
}

export type Database = {
  public: {
    Tables: {
      User: { Row: UserRow }
      Workspace: { Row: WorkspaceRow }
      WorkspaceMember: { Row: WorkspaceMemberRow }
      WorkspaceInvitation: { Row: WorkspaceInvitationRow }
      Campaign: { Row: CampaignRow }
      Client: { Row: ClientRow }
      DebtRecord: { Row: DebtRecordRow }
    }
    Views: Record<string, never>
    Enums: {
      ActionType:
        | 'LINK_SENT'
        | 'LINK_CLICKED'
        | 'PROMISE_MADE'
        | 'PROMISE_UPDATED'
        | 'PAYMENT_CONFIRMED'
        | 'STATUS_CHANGED'
        | 'NOTE_ADDED'
        | 'EMAIL_SENT'
        | 'SMS_SENT'
        | 'PHONE_CALL'
        | 'OTHER'
      CampaignStatus: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
      DebtStatus: 'IMPORTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'
      InvitationStatus: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
      PromiseStatus: 'ACTIVE' | 'KEPT' | 'BROKEN' | 'CANCELLED'
      WorkspaceRole: 'OWNER' | 'MANAGER' | 'AGENT'
      WorkspaceMemberStatus: 'ACTIVE' | 'INACTIVE'
    }
    CompositeTypes: Record<string, never>
  }
}

type DatabaseWithoutInternals = Database

type DefaultSchema = DatabaseWithoutInternals['public']

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | {
    schema: keyof DatabaseWithoutInternals
  },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | {
    schema: keyof DatabaseWithoutInternals
  },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | {
    schema: keyof DatabaseWithoutInternals
  },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | {
    schema: keyof DatabaseWithoutInternals
  },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes'] | {
    schema: keyof DatabaseWithoutInternals
  },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ActionType: [
        'LINK_SENT',
        'LINK_CLICKED',
        'PROMISE_MADE',
        'PROMISE_UPDATED',
        'PAYMENT_CONFIRMED',
        'STATUS_CHANGED',
        'NOTE_ADDED',
        'EMAIL_SENT',
        'SMS_SENT',
        'PHONE_CALL',
        'OTHER',
      ],
      CampaignStatus: ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      DebtStatus: ['IMPORTED', 'UNPAID', 'NOTIFIED', 'PROMISE_TO_PAY', 'PAID', 'OVERDUE_AFTER_PROMISE'],
      InvitationStatus: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
      PromiseStatus: ['ACTIVE', 'KEPT', 'BROKEN', 'CANCELLED'],
      WorkspaceRole: ['OWNER', 'MANAGER', 'AGENT'],
      WorkspaceMemberStatus: ['ACTIVE', 'INACTIVE'],
    },
  },
} as const
