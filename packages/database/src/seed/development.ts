// packages/database/src/seed/development.ts
import { fileURLToPath } from 'url';
import path from 'path';
import { PrismaClient, Role } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);

const prisma = new PrismaClient();

async function seedDevelopment() {
  // Default company used when new users sign up without a companyId (Swagger/frontend)
  const defaultCompany = await prisma.company.upsert({
    where: { name: 'Default' },
    update: {},
    create: {
      name: 'Default',
      website: null,
    },
  });
  console.log('Created/Updated Default Company:', defaultCompany);

  // Create a test company
  const company = await prisma.company.upsert({
    where: { name: 'Test Debt Collection Co.' },
    update: {},
    create: {
      name: 'Test Debt Collection Co.',
      website: 'https://testdebtco.tn',  // Example website for testing
    },
  });
  console.log('Created/Updated Company:', company);

  // Note: For the user, you need a real Supabase Auth user ID.
  // Step 1: Register a test user via the API (POST /api/v1/authentication/register) or Supabase dashboard.
  // Step 2: Copy the auth.users.id (UUID) from Supabase dashboard > Authentication > Users.
  // Step 3: Replace 'your-supabase-user-uuid-here' below with that ID.
  const testUserId = 'b39fd63b-c9b3-40e0-a250-455458dde401'; // Replace this!

  // Create a test internal user (linked to Supabase Auth ID)
  const user = await prisma.user.upsert({
    where: { id: testUserId },
    update: {},
    create: {
      id: testUserId,
      email: 'test@debtco.com', // Must match the Supabase user's email
      fullName: 'Test Manager',
      role: 'MANAGER' as Role, // Type-safe enum
      companyId: company.id,
    },
  });
  console.log('Created/Updated User:', user);
}

export default seedDevelopment;

// Only run the seed if this file is executed directly (e.g., via pnpm db:seed:dev)
if (process.argv[1] === __filename) {
  seedDevelopment()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}