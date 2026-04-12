import type { BackendUserProfile } from './users.js';
export type LoginPayload = {
    email: string;
    password: string;
};
export type RegisterPayload = {
    email: string;
    password: string;
    fullName: string;
    workspaceName?: string;
    website?: string;
    inviteToken?: string;
};
export type RegisterResult = {
    userId: string;
    email: string;
    requiresEmailVerification: boolean;
};
export type LoginResponseUser = BackendUserProfile & {
    emailConfirmed?: boolean;
};
export type LoginResponseData = {
    accessToken: string;
    refreshToken?: string | null;
    user: LoginResponseUser;
};
export type RefreshResponseData = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: LoginResponseUser;
};
//# sourceMappingURL=auth.d.ts.map