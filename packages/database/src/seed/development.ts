// packages/database/src/seed/development.ts
import { fileURLToPath } from 'url';
import path from 'path';
import { PrismaClient, WorkspaceRole, CampaignStatus, DebtStatus, PromiseStatus, ActionType, Prisma } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);

const prisma = new PrismaClient();

async function seedDevelopment() {
  // 1. Create Owner User FIRST (must match a real Supabase user ID for auth sync)
  // IMPORTANT: Replace with a REAL Supabase auth.users.id (get it from dashboard)
  const ownerId = 'b39fd63b-c9b3-40e0-a250-455458dde401'; // ← Replace with real Supabase user UUID

  const owner = await prisma.user.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      email: 'owner@agency.tn',
      fullName: 'Patron Owner',
    },
  });
  console.log('Owner created:', owner.id);

  // 2. Create Workspace (Company) - now with owner relationship
  const workspace = await prisma.workspace.upsert({
    where: {
      createdByUserId_name: {
        createdByUserId: owner.id,
        name: 'Test Debt Collection Agency',
      },
    },
    update: {},
    create: {
      name: 'Test Debt Collection Agency',
      website: 'https://testagency.tn',
      createdByUserId: owner.id,
    },
  });
  console.log('Workspace created:', workspace.id);

  // Link owner to workspace as OWNER
  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: owner.id, workspaceId: workspace.id } },
    update: {},
    create: {
      userId: owner.id,
      workspaceId: workspace.id,
      role: WorkspaceRole.OWNER,
    },
  });
  console.log('Owner linked to workspace');

  // 3. Create 2 Campaigns
  const campaignActive = await prisma.campaign.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      workspaceId: workspace.id,
      name: 'Ramadan Overdues 2026',
      description: 'Focus on overdue debts before Eid',
      status: CampaignStatus.ACTIVE,
    },
  });

  const campaignDraft = await prisma.campaign.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      workspaceId: workspace.id,
      name: 'Q2 Postpaid Collection',
      description: 'Planned for April-June',
      status: CampaignStatus.DRAFT,
    },
  });
  console.log('Campaigns created');

  // 4. Create 3 Clients (customers)
  const clients = await prisma.client.createMany({
    data: [
      {
        workspaceId: workspace.id,
        fullName: 'Mohamed Ben Ali',
        email: 'mohamed@example.tn',
        phone: '+21698123456',
      },
      {
        workspaceId: workspace.id,
        fullName: 'Fatma Zahra Trabelsi',
        email: 'fatma.zahra@laposte.tn',
        phone: '+21622123456',
      },
      {
        workspaceId: workspace.id,
        fullName: 'Ali Ben Romdhane',
        email: 'ali.br@ooredoo.tn',
        phone: '+21650123456',
      },
    ],
    skipDuplicates: true,
  });
  console.log('Clients created');

  // Fetch clients to use their IDs
  const createdClients = await prisma.client.findMany({
    where: { workspaceId: workspace.id },
    take: 3,
  });

  if (createdClients.length === 0) {
    throw new Error('No clients found after creation');
  }

  if (!createdClients[0] || !createdClients[1] || !createdClients[2]) {
    throw new Error('Not enough clients found after creation');
  }

  // 5. Create 5 DebtRecords (spread across campaigns)
  await prisma.debtRecord.createMany({
    data: [
      {
        campaignId: campaignActive.id,
        clientId: createdClients[0]!.id,
        amount: 450.00,
        dueDate: new Date('2026-03-10'),
        status: DebtStatus.IMPORTED,
      },
      {
        campaignId: campaignActive.id,
        clientId: createdClients[0]!.id,
        amount: 1200.50,
        dueDate: new Date('2026-02-28'),
        status: DebtStatus.NOTIFIED,
      },
      {
        campaignId: campaignActive.id,
        clientId: createdClients[1]!.id,
        amount: 780.00,
        dueDate: new Date('2026-04-10'),
        status: DebtStatus.PROMISE_TO_PAY,
        promiseDate: new Date('2026-04-05'),
      },
      {
        campaignId: campaignDraft.id,
        clientId: createdClients[2]!.id,
        amount: 3200.00,
        dueDate: new Date('2026-05-15'),
        status: DebtStatus.PAID,
      },
      {
        campaignId: campaignActive.id,
        clientId: createdClients[1]!.id,
        amount: 890.75,
        dueDate: new Date('2026-01-20'),
        status: DebtStatus.OVERDUE_AFTER_PROMISE,
      },
    ],
  });
  console.log('Debts created');

  // 6. Create PaymentPromises (for debts with PROMISE_TO_PAY or related)
  const promiseDebt = await prisma.debtRecord.findFirst({
    where: { status: DebtStatus.PROMISE_TO_PAY },
  });

  if (promiseDebt) {
    await prisma.paymentPromise.createMany({
      data: [
        {
          debtId: promiseDebt.id,
          promisedDate: new Date('2026-04-05'),
          status: PromiseStatus.KEPT,
        },
        {
          debtId: promiseDebt.id,
          promisedDate: new Date('2026-04-15'),
          status: PromiseStatus.BROKEN,
        },
      ],
    });
    console.log('Payment promises created');
  }

  // 7. Create some CustomerActionHistory (timeline)
  const actionClient = createdClients[0];

  if (!actionClient) {
    throw new Error('No action client found');
  }

  const actionHistoryData: Prisma.CustomerActionHistoryCreateManyArgs['data'] = [];

  // Add debt-related actions only if promiseDebt exists
  if (promiseDebt) {
    actionHistoryData.push({
      customerId: actionClient.id,
      debtId: promiseDebt.id,
      actionType: ActionType.LINK_SENT,
      performedBy: owner.id,
      metadata: { channel: 'email', template: 'reminder-1' },
    });
    actionHistoryData.push({
      customerId: actionClient.id,
      debtId: promiseDebt.id,
      actionType: ActionType.LINK_CLICKED,
      metadata: { ip: '196.203.10.50', device: 'mobile' },
    });
  }

  // Add customer-level actions (no debtId)
  actionHistoryData.push({
    customerId: actionClient.id,
    actionType: ActionType.STATUS_CHANGED,
    performedBy: owner.id,
    metadata: { oldStatus: 'IMPORTED', newStatus: 'NOTIFIED' },
  });
  actionHistoryData.push({
    customerId: actionClient.id,
    actionType: ActionType.NOTE_ADDED,
    performedBy: owner.id,
    metadata: { note: 'Client called, confirmed moving abroad' },
  });

  await prisma.customerActionHistory.createMany({
    data: actionHistoryData,
  });
  console.log('Action history created');

  console.log('Development seed completed successfully!');
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