import { PrismaClient, Role, InventoryType, InventoryStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Admin user ───────────────────────────────────────────────────────────
  const adminEmail = 'admin@oasisgym.com';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const hashedPassword = await bcrypt.hash('Admin123*', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: Role.ADMIN,
        mustChangePassword: false,
      },
    });
    console.log('✅ Admin user created: admin@oasisgym.com');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ── Activities ───────────────────────────────────────────────────────────
  const activities = [
    { name: 'CrossFit', description: 'High-intensity functional fitness training' },
    { name: 'Hyrox', description: 'Fitness race combining running and functional exercises' },
    { name: 'CrossFit Kids', description: 'CrossFit adapted for children' },
    { name: 'Calistenia', description: 'Bodyweight strength training' },
    { name: 'Open Box', description: 'Open gym time for free training' },
  ];

  for (const activity of activities) {
    await prisma.activity.upsert({
      where: { name: activity.name },
      update: {},
      create: activity,
    });
  }
  console.log('✅ Activities seeded');

  // ── Membership plans ─────────────────────────────────────────────────────
  const plans = [
    { name: 'Ilimitado', description: 'Acceso ilimitado a todas las actividades', price: 700, duration: 30 },
    { name: 'Estudiantes', description: 'Membresía con descuento para estudiantes', price: 500, duration: 30 },
    { name: 'Kids', description: 'Membresía para niños — CrossFit Kids', price: 500, duration: 30 },
    { name: 'Bonos', description: 'Paquete de 10 clases sin vencimiento mensual', price: 600, duration: 90 },
  ];

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
  }
  console.log('✅ Membership plans seeded');

  // ── Sample inventory ─────────────────────────────────────────────────────
  const equipment = [
    { name: 'Barra Olímpica', category: 'Barras', type: InventoryType.EQUIPMENT, quantity: 10, status: InventoryStatus.AVAILABLE },
    { name: 'Disco 20kg', category: 'Discos', type: InventoryType.EQUIPMENT, quantity: 20, status: InventoryStatus.AVAILABLE },
    { name: 'Disco 10kg', category: 'Discos', type: InventoryType.EQUIPMENT, quantity: 20, status: InventoryStatus.AVAILABLE },
    { name: 'Disco 5kg', category: 'Discos', type: InventoryType.EQUIPMENT, quantity: 20, status: InventoryStatus.AVAILABLE },
    { name: 'Mancuerna 10kg', category: 'Mancuernas', type: InventoryType.EQUIPMENT, quantity: 5, status: InventoryStatus.AVAILABLE },
    { name: 'Kettlebell 16kg', category: 'Kettlebells', type: InventoryType.EQUIPMENT, quantity: 6, status: InventoryStatus.AVAILABLE },
    { name: 'Remo Concept2', category: 'Cardio', type: InventoryType.EQUIPMENT, quantity: 3, status: InventoryStatus.AVAILABLE },
    { name: 'Bicicleta Assault', category: 'Cardio', type: InventoryType.EQUIPMENT, quantity: 2, status: InventoryStatus.AVAILABLE },
    { name: 'SkiErg', category: 'Cardio', type: InventoryType.EQUIPMENT, quantity: 2, status: InventoryStatus.AVAILABLE },
    { name: 'Cuerda de Salto', category: 'Accesorios', type: InventoryType.EQUIPMENT, quantity: 15, status: InventoryStatus.AVAILABLE },
    { name: 'Cajón Pliométrico', category: 'Cajones', type: InventoryType.EQUIPMENT, quantity: 8, status: InventoryStatus.AVAILABLE },
  ];

  for (const item of equipment) {
    const exists = await prisma.inventory.findFirst({ where: { name: item.name } });
    if (!exists) {
      await prisma.inventory.create({ data: item });
    }
  }
  console.log('✅ Inventory seeded');

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
