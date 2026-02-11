import { PrismaClient } from '@repo/database';

import { AbstractServiceOptions } from '../types/services.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';

export class UsersService {
  prisma: PrismaClient;

  constructor(options: AbstractServiceOptions) {
    this.prisma = options.prisma;
  }

  async getLoggedUserData(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: {
        id,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });
  }

  async updateLoggedUserData(id: string, data: { fullName?: string }) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    return updated;
  }

  async deleteLoggedUser(id: string) {
    const serviceClient = getSupabaseServiceClient();

    // First delete from Supabase Auth (primary source of truth)
    const { error } = await serviceClient.auth.admin.deleteUser(id);

    if (error) {
      // Surface a clear error so the caller can handle / log it
      throw new Error(error.message);
    }

    // Then delete the corresponding record from our local `user` table
    await this.prisma.user.delete({
      where: { id },
    });
  }
}