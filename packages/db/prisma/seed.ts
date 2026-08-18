import { PrismaClient } from "../src/generated/client/index.js";
import {
  PERMISSION_CODES,
  ROLE_TEMPLATE_PERMISSIONS,
  ROLE_TEMPLATE_NAMES,
  SUBSCRIPTION_PLANS_SEED,
} from "@kranjang/shared";

const prisma = new PrismaClient();

async function main() {
  for (const code of PERMISSION_CODES) {
    const [module] = code.split(".");
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, module, description: code },
    });
  }

  const permissions = await prisma.permission.findMany();
  const byCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const plan of SUBSCRIPTION_PLANS_SEED) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        durationDays: plan.durationDays,
        maxOutlets: plan.maxOutlets,
        featureReports: plan.featureReports,
        featureInventory: plan.featureInventory,
        featureMultiOutlet: plan.featureMultiOutlet,
        featureExport: plan.featureExport,
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        durationDays: plan.durationDays,
        maxOutlets: plan.maxOutlets,
        featureReports: plan.featureReports,
        featureInventory: plan.featureInventory,
        featureMultiOutlet: plan.featureMultiOutlet,
        featureExport: plan.featureExport,
        isActive: true,
      },
    });
  }

  for (const name of ROLE_TEMPLATE_NAMES) {
    let role = await prisma.role.findFirst({ where: { tenantId: null, name } });
    if (!role) {
      role = await prisma.role.create({
        data: { tenantId: null, name, isSystem: true },
      });
    } else {
      role = await prisma.role.update({
        where: { id: role.id },
        data: { isSystem: true },
      });
    }

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_TEMPLATE_PERMISSIONS[name].map((code) => ({
        roleId: role.id,
        permissionId: byCode.get(code)!,
      })),
    });
  }
}

main().finally(() => prisma.$disconnect());
