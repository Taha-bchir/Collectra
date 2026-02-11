import type { PrismaClient, Role as PrismaUserRole } from '@repo/database';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Database } from '@repo/types';
import type { AuthenticationServiceOptions } from '../types/services.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';

/** API/frontend role (USER | ADMIN | DEMO). Stored in JWT and returned in responses. */
type DbUserRole = Database['public']['Enums']['UserRole'];

const EXTERNAL_ROLES: DbUserRole[] = ['USER', 'ADMIN', 'DEMO'];
const DEFAULT_EXTERNAL_ROLE: DbUserRole = 'USER';

/** Map API/frontend role to Prisma Role (MANAGER | AGENT) for DB storage. */
function mapExternalRoleToPrisma(external: DbUserRole): PrismaUserRole {
  switch (external) {
    case 'ADMIN':
      return 'MANAGER';
    case 'USER':
    case 'DEMO':
    default:
      return 'AGENT';
  }
}

const DEFAULT_COMPANY_NAME = 'Default';

async function getOrCreateDefaultCompany(prisma: PrismaClient): Promise<string> {
  const company = await prisma.company.findFirst({ where: { name: DEFAULT_COMPANY_NAME } });
  if (company) return company.id;
  const created = await prisma.company.create({
    data: { name: DEFAULT_COMPANY_NAME, updatedAt: new Date() },
  });
  return created.id;
}

const PROFILE_FIELDS = [
  'fullName',
  'streetAddress',
  'city',
  'state',
  'postalCode',
  'country',
] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];
type UserProfileShape = Pick<Database['public']['Tables']['users']['Row'], ProfileField>;
type UserProfileInput = Partial<UserProfileShape>;

type RegisterPayload = UserProfileInput & {
  email: string;
  password: string;
  role?: DbUserRole;
  companyId?: string;  // Add if needed for registration
};

type LoginPayload = {
  email: string;
  password: string;
};

type PasswordResetPayload = {
  email: string;
};

type PasswordChangePayload = {
  userId: string;
  newPassword: string;
};

type RefreshPayload = {
  refreshToken: string;
};

type GoogleOAuthPayload = {
  redirectTo?: string;
};

type GoogleOAuthCallbackPayload = {
  code: string;
  state?: string;
};

type GoogleOAuthTokenPayload = {
  accessToken: string;
  refreshToken?: string;
};

type SupabaseClientType = AuthenticationServiceOptions['supabase'];

export class AuthenticationService {
  private prisma: PrismaClient;
  private supabase: SupabaseClientType;
  private emailRedirectTo?: string;
  private resetRedirectTo?: string;
  private oauthRedirectTo?: string;

  constructor(options: AuthenticationServiceOptions) {
    this.prisma = options.prisma;
    this.supabase = options.supabase;
    this.emailRedirectTo = options.emailRedirectTo;
    this.resetRedirectTo = options.resetRedirectTo;
    this.oauthRedirectTo = options.oauthRedirectTo;
  }

  async registerUser(payload: RegisterPayload) {
    const externalRole: DbUserRole = payload.role ?? DEFAULT_EXTERNAL_ROLE;
    const prismaRole = mapExternalRoleToPrisma(externalRole);
    const profileMetadata = this.pickProfileFields(payload);
    const companyId =
      payload.companyId ?? (await getOrCreateDefaultCompany(this.prisma));

    const { data, error } = await this.supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: this.emailRedirectTo,
        data: {
          role: externalRole,
          ...profileMetadata,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    const supabaseUser = data.user;

    if (!supabaseUser) {
      throw new Error('Supabase user record missing after signup.');
    }

    const { dbUser } = await this.upsertUserFromSupabase(supabaseUser, {
      fullName: profileMetadata.fullName ?? null,
      role: prismaRole,
      companyId,
      externalRole,
    });

    return {
      id: dbUser.id,
      email: dbUser.email,
      role: externalRole,
      profile: { fullName: dbUser.fullName ?? null },
      requiresEmailVerification: !data.session,
    };
  }

  async signIn(payload: LoginPayload) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { session, user } = data;

    if (!session || !user) {
      throw new Error('Invalid credentials.');
    }

    const { dbUser, externalRole } = await this.upsertUserFromSupabase(user);

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: externalRole,
        profile: { fullName: dbUser.fullName ?? null },
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
    };
  }

  async requestPasswordReset(payload: PasswordResetPayload) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(payload.email, {
      redirectTo: this.resetRedirectTo,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      message: 'If an account exists for that email, a reset link is on the way.',
    };
  }

  async resetPassword(payload: PasswordChangePayload) {
    const serviceClient = getSupabaseServiceClient();

    const { error } = await serviceClient.auth.admin.updateUserById(
      payload.userId,
      {
        password: payload.newPassword,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return {
      message: 'Password has been updated successfully.',
    };
  }

  async refreshSession(payload: RefreshPayload) {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: payload.refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { session, user } = data;

    if (!session || !user) {
      const err = new Error('Invalid refresh token.');
      (err as { status?: number }).status = 401;
      throw err;
    }

    const { dbUser, externalRole } = await this.upsertUserFromSupabase(user);

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: externalRole,
        profile: { fullName: dbUser.fullName ?? null },
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
    };
  }

private async upsertUserFromSupabase(
    user: SupabaseUser,
    overrides?: {
      fullName?: string | null;
      role?: PrismaUserRole;
      companyId?: string;
      externalRole?: DbUserRole;
    }
  ): Promise<{ dbUser: Awaited<ReturnType<PrismaClient['user']['upsert']>>; externalRole: DbUserRole }> {
    const email = user.email;
    if (!email) {
      throw new Error('Supabase user missing email.');
    }

    const metadataRole = user.user_metadata?.role as string | undefined;
    const prismaRole: PrismaUserRole =
      overrides?.role ??
      (metadataRole ? mapExternalRoleToPrisma(metadataRole as DbUserRole) : undefined) ??
      'AGENT';
    const externalRole: DbUserRole =
      overrides?.externalRole ??
      (EXTERNAL_ROLES.includes(metadataRole as DbUserRole) ? (metadataRole as DbUserRole) : undefined) ??
      DEFAULT_EXTERNAL_ROLE;

    const companyId =
      overrides?.companyId ?? (await getOrCreateDefaultCompany(this.prisma));
    const fullName = overrides?.fullName ?? (user.user_metadata?.fullName as string | undefined) ?? null;

    const dbUser = await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email,
        fullName,
        role: prismaRole,
      },
      create: {
        id: user.id,
        email,
        fullName,
        role: prismaRole,
        companyId,
      },
    });

    const serviceClient = getSupabaseServiceClient();
    await serviceClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata as Record<string, unknown>),
        role: externalRole,
      },
    });

    return { dbUser, externalRole };
  }

  async getGoogleOAuthUrl(payload: GoogleOAuthPayload) {
    const redirectTo = payload.redirectTo || this.oauthRedirectTo;
    
    if (!redirectTo) {
      throw new Error('OAuth redirect URL is not configured');
    }

    // Use Supabase's signInWithOAuth - it will handle PKCE flow
    // The redirectTo URL should be configured in Supabase dashboard
    // Supabase will redirect to: https://[project].supabase.co/auth/v1/callback
    // Then redirect to our redirectTo URL with code in query params
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.url) {
      throw new Error('Failed to generate OAuth URL');
    }

    return {
      url: data.url,
    };
  }

  async handleGoogleOAuthCallback(payload: GoogleOAuthCallbackPayload) {
    // Use service client for code exchange (more secure for server-side OAuth)
    const serviceClient = getSupabaseServiceClient();
    
    // Exchange the code for a session
    const { data, error } = await serviceClient.auth.exchangeCodeForSession(payload.code);

    if (error) {
      throw new Error(error.message);
    }

    const { session, user } = data;

    if (!session || !user) {
      throw new Error('Invalid OAuth callback response');
    }

    // Extract profile data from Google OAuth response
    const googleProfile = user.user_metadata;
    const profileMetadata = this.pickProfileFields({
      fullName: googleProfile?.full_name || googleProfile?.name,
      ...googleProfile,
    });

    const externalRole: DbUserRole = (googleProfile?.role as DbUserRole | undefined) ?? 'USER';

    const { dbUser } = await this.upsertUserFromSupabase(user, {
      fullName: profileMetadata.fullName ?? null,
      externalRole,
    });

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: externalRole,
        profile: { fullName: dbUser.fullName ?? null },
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
    };
  }

  async handleGoogleOAuthTokens(payload: GoogleOAuthTokenPayload) {
    // Validate tokens with Supabase and get user info
    const serviceClient = getSupabaseServiceClient();
    
    // Set the session using the access token
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(payload.accessToken);

    if (userError || !user) {
      throw new Error(userError?.message || 'Invalid access token');
    }

    // Extract profile data from Google OAuth response
    const googleProfile = user.user_metadata;
    const profileMetadata = this.pickProfileFields({
      fullName: googleProfile?.full_name || googleProfile?.name,
      ...googleProfile,
    });

    const externalRole: DbUserRole = (googleProfile?.role as DbUserRole | undefined) ?? 'USER';

    const { dbUser } = await this.upsertUserFromSupabase(user, {
      fullName: profileMetadata.fullName ?? null,
      externalRole,
    });

    // Get session info - we'll use the provided tokens
    // Calculate expires_in (default to 3600 seconds / 1 hour)
    const expiresIn = 3600;

    // Ensure refreshToken is always a string (required by schema)
    const refreshToken: string = payload.refreshToken || '';

    return {
      accessToken: payload.accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: externalRole,
        profile: { fullName: dbUser.fullName ?? null },
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
    };
  }

  private pickProfileFields(source?: unknown): Partial<UserProfileShape> {
    if (!source || typeof source !== 'object') {
      return {};
    }

    return PROFILE_FIELDS.reduce((acc, field) => {
      const value = (source as Record<string, unknown>)[field];

      if (value !== undefined) {
        // All profile fields are string | null, so validate the type
        if (value === null || typeof value === 'string') {
          acc[field] = value as UserProfileShape[typeof field];
        }
      }

      return acc;
    }, {} as Partial<UserProfileShape>);
  }
}
