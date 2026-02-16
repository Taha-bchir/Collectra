// packages/database/src/seed/development.ts
import { fileURLToPath } from 'url';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);

const prisma = new PrismaClient();

async function seedDevelopment() {
  // Note: For the test user, you need a real Supabase Auth user ID.
  // Step 1: Register a test user via the API (POST /api/v1/authentication/register) or Supabase dashboard.
  // Step 2: Copy the auth.users.id (UUID) from Supabase dashboard > Authentication > Users.
  // Step 3: Replace 'your-supabase-user-uuid-here' below with that ID.
  const testUserId = 'b39fd63b-c9b3-40e0-a250-455458dde401'; // Replace this!

  // Create a test user (linked to Supabase Auth ID)
  const user = await prisma.user.upsert({
    where: { id: testUserId },
    update: {},
    create: {
      id: testUserId,
      email: 'test@collectra.com', // Must match the Supabase user's email
      fullName: 'Test User',
    },
  });
  console.log('Created/Updated User:', user);

  // Create a test workspace
  const workspace = await prisma.workspace.upsert({
    where: { 
      createdByUserId_name: {
        createdByUserId: user.id,
        name: 'Test Workspace',
      }
    },
    update: {},
    create: {
      name: 'Test Workspace',
      website: 'https://testworkspace.com',
      createdByUserId: user.id,
    },
  });
  console.log('Created/Updated Workspace:', workspace);

  // Add user as workspace member (owner)
  const workspaceMember = await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  });
  console.log('Created/Updated Workspace Member:', workspaceMember);

  // Create a test client
  const client = await prisma.client.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      workspaceId: workspace.id,
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      address: '123 Main St, City, Country',
    },
  });
  console.log('Created/Updated Client:', client);

  // Create a test campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      workspaceId: workspace.id,
      name: 'Q1 2026 Collection Campaign',
      description: 'First quarter debt collection campaign',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: 'ACTIVE',
    },
  });
  console.log('Created/Updated Campaign:', campaign);

  // Create a test debt
  const debt = await prisma.debt.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      campaignId: campaign.id,
      clientId: client.id,
      amount: 1500.00,
      dueDate: new Date('2026-02-15'),
      status: 'NOTIFIED',
    },
  });
  console.log('Created/Updated Debt:', debt);
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