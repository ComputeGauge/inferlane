import prisma from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  // 1. Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@inferlane.ai' },
    update: {},
    create: {
      email: 'demo@inferlane.ai',
      name: 'Demo User',
      role: 'USER',
    },
  });
  console.log(`  User: ${demoUser.email} (${demoUser.id})`);

  // 2. Demo Subscription (FREE / ACTIVE)
  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      tier: 'FREE',
      status: 'ACTIVE',
    },
  });
  console.log('  Subscription: FREE / ACTIVE');

  // 3. Marketplace Listings
  const listings = [
    { provider: 'ANTHROPIC', name: 'Anthropic', category: 'cloud_api', isFeatured: true },
    { provider: 'OPENAI', name: 'OpenAI', category: 'cloud_api', isFeatured: true },
    { provider: 'GOOGLE', name: 'Google AI', category: 'cloud_api', isFeatured: false },
    { provider: 'CEREBRAS', name: 'Cerebras', category: 'inference', isFeatured: true, note: 'Ultra-fast inference' },
    { provider: 'MODAL', name: 'Modal', category: 'gpu_cloud', isFeatured: false },
  ];

  for (const listing of listings) {
    await prisma.marketplaceListing.upsert({
      where: {
        // MarketplaceListing has no unique on provider, so we find-or-create manually
        id: (await prisma.marketplaceListing.findFirst({ where: { provider: listing.provider } }))?.id ?? 'nonexistent',
      },
      update: {},
      create: {
        provider: listing.provider,
        name: listing.name,
        category: listing.category,
        isFeatured: listing.isFeatured,
        description: listing.note ?? null,
      },
    });
    console.log(`  Listing: ${listing.name} (${listing.category})`);
  }

  // 4. Sample Partner
  const callbackKeyHash = await bcrypt.hash('ilp_demo_openclaw_key_12345', 10);
  await prisma.partner.upsert({
    where: { slug: 'openclaw' },
    update: {},
    create: {
      name: 'OpenClaw',
      slug: 'openclaw',
      contactEmail: 'hello@openclaw.com',
      revSharePct: 0.10,
      callbackKeyHash,
    },
  });
  console.log('  Partner: OpenClaw');

  // 5. Sample Alerts for demo user
  const existingAlerts = await prisma.alert.findMany({ where: { userId: demoUser.id } });
  if (existingAlerts.length === 0) {
    await prisma.alert.createMany({
      data: [
        {
          userId: demoUser.id,
          type: 'BUDGET_WARNING',
          threshold: 50,
          channel: 'EMAIL',
          isActive: true,
        },
        {
          userId: demoUser.id,
          type: 'SPEND_SPIKE',
          threshold: 100,
          channel: 'EMAIL',
          isActive: true,
        },
      ],
    });
    console.log('  Alerts: BUDGET_WARNING ($50), SPEND_SPIKE ($100)');
  } else {
    console.log(`  Alerts: skipped (${existingAlerts.length} already exist)`);
  }

  console.log('Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
