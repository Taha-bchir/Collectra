// packages/database/src/seed/index.ts
// Select and run a seed based on NODE_ENV
import seedDev from './development.js';
import seedProd from './production.js';
import seedStaging from './staging.js';
import { PrismaClient } from '@prisma/client';

// Logic to select seed based on environment
const env = process.env.NODE_ENV || 'development';

let seedFunction: () => Promise<void>;
if (env === 'development') {
  seedFunction = seedDev;
} else if (env === 'production') {
  seedFunction = seedProd;
} else if (env === 'staging') {
  seedFunction = seedStaging;
} else {
  throw new Error(`Unknown environment: ${env}`);
}

// Run the selected seed (if this file is executed directly)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const prisma = new PrismaClient();
  
  seedFunction()
    .catch((e) => {
      console.error('Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedDev, seedProd, seedStaging };
