import { PrismaClient } from "../src/generated/client/index.js";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: "kranjang-test-" } },
    select: { id: true, tenantId: true },
  });
  const tenantIds = [...new Set(users.map((user) => user.tenantId).filter(Boolean))] as string[];

  await prisma.stockMovement.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.salePayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.saleItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.sale.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.cashierSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.purchaseItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.purchase.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.expense.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.recipeItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.productImage.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.supplier.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
  await prisma.rolePermission.deleteMany({
    where: { role: { tenantId: { in: tenantIds } } },
  });
  await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.expenseCategory.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantSettings.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.outlet.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  console.log(`Removed ${tenantIds.length} test tenants.`);
}

main().finally(() => prisma.$disconnect());
