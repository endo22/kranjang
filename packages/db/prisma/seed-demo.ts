import { PrismaClient } from "../src/generated/client/index.js";

const DEMO_OWNER_EMAIL = "owner@kranjang.local";
const DEMO_CASHIER_EMAIL = "cashier@kranjang.local";
/** password12 */
const CASHIER_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$rVBMeCmKu2GtrmHQVzRhCg$JtETVl5CfPkJfATASDJcPX+nhrF90lGht+nDu+HqgRo";

const prisma = new PrismaClient();

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function dateOnly(days: number) {
  return daysAgo(days);
}

async function clearTenantOps(tenantId: string, ownerUserId: string) {
  await prisma.stockMovement.deleteMany({ where: { tenantId } });
  await prisma.salePayment.deleteMany({ where: { tenantId } });
  await prisma.saleItem.deleteMany({ where: { tenantId } });
  await prisma.sale.deleteMany({ where: { tenantId } });
  await prisma.cashierSession.deleteMany({ where: { tenantId } });
  await prisma.purchaseItem.deleteMany({ where: { tenantId } });
  await prisma.purchase.deleteMany({ where: { tenantId } });
  await prisma.expense.deleteMany({ where: { tenantId } });
  await prisma.recipeItem.deleteMany({ where: { tenantId } });
  await prisma.productImage.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.supplier.deleteMany({ where: { tenantId } });

  const extraUsers = await prisma.user.findMany({
    where: { tenantId, id: { not: ownerUserId }, deletedAt: null },
    select: { id: true },
  });
  const extraIds = extraUsers.map((user) => user.id);
  if (extraIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: extraIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: extraIds } } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: extraIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: extraIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: extraIds } } });
    await prisma.user.deleteMany({ where: { id: { in: extraIds } } });
  }
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: DEMO_OWNER_EMAIL, deletedAt: null },
    include: { tenant: true },
  });

  if (!owner?.tenantId || !owner.tenant) {
    throw new Error(
      `User ${DEMO_OWNER_EMAIL} belum ada. Daftarkan/login dulu, lalu jalankan ulang seed:demo.`,
    );
  }

  const tenantId = owner.tenantId;
  const outlet = await prisma.outlet.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { isDefault: "desc" },
  });
  if (!outlet) {
    throw new Error("Outlet tenant demo tidak ditemukan.");
  }

  const cashierRole = await prisma.role.findFirst({
    where: { tenantId, name: "Cashier" },
  });
  if (!cashierRole) {
    throw new Error("Role Cashier belum tersedia di tenant demo.");
  }

  console.log(`Seeding demo untuk ${owner.tenant.name} (${tenantId})…`);
  await clearTenantOps(tenantId, owner.id);

  const cashier = await prisma.user.create({
    data: {
      tenantId,
      name: "Kasir Demo",
      email: DEMO_CASHIER_EMAIL,
      passwordHash: CASHIER_PASSWORD_HASH,
      emailVerifiedAt: new Date(),
      userRoles: { create: { roleId: cashierRole.id } },
    },
  });

  const [catMakanan, catMinuman, catBahan] = await Promise.all([
    prisma.category.create({ data: { tenantId, name: "Makanan", sortOrder: 1 } }),
    prisma.category.create({ data: { tenantId, name: "Minuman", sortOrder: 2 } }),
    prisma.category.create({ data: { tenantId, name: "Bahan", sortOrder: 3 } }),
  ]);

  const [supplierUtama, supplierSayur] = await Promise.all([
    prisma.supplier.create({
      data: { tenantId, name: "CV Sumber Segar", phone: "081200000001", address: "Pasar Induk" },
    }),
    prisma.supplier.create({
      data: { tenantId, name: "Toko Kemasan Jaya", phone: "081200000002" },
    }),
  ]);

  const [custAndi, custSiti, custBudi] = await Promise.all([
    prisma.customer.create({ data: { tenantId, name: "Andi Pelanggan", phone: "081311110001" } }),
    prisma.customer.create({ data: { tenantId, name: "Siti Langganan", phone: "081311110002" } }),
    prisma.customer.create({ data: { tenantId, name: "Budi Walk-in", phone: "081311110003" } }),
  ]);

  const beras = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catBahan.id,
      supplierId: supplierUtama.id,
      sku: "BHN-BERAS",
      barcode: "8991001000001",
      name: "Beras",
      unit: "kg",
      productType: "INGREDIENT",
      buyPrice: 12000,
      sellPrice: 0,
      avgCost: 0,
      stock: 0,
      minStock: 5,
    },
  });

  const telur = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catBahan.id,
      supplierId: supplierUtama.id,
      sku: "BHN-TELUR",
      barcode: "8991001000002",
      name: "Telur",
      unit: "butir",
      productType: "INGREDIENT",
      buyPrice: 2000,
      sellPrice: 0,
      avgCost: 0,
      stock: 0,
      minStock: 20,
    },
  });

  const airMineral = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catMinuman.id,
      supplierId: supplierSayur.id,
      sku: "MNM-AIR",
      barcode: "8991002000001",
      name: "Air Mineral 600ml",
      unit: "botol",
      productType: "SIMPLE",
      buyPrice: 2500,
      sellPrice: 4000,
      avgCost: 0,
      stock: 0,
      minStock: 12,
    },
  });

  const kopiSachet = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catMinuman.id,
      supplierId: supplierSayur.id,
      sku: "MNM-KOPI",
      barcode: "8991002000002",
      name: "Kopi Sachet",
      unit: "pcs",
      productType: "SIMPLE",
      buyPrice: 1500,
      sellPrice: 5000,
      avgCost: 0,
      stock: 0,
      minStock: 10,
    },
  });

  const keripik = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catMakanan.id,
      supplierId: supplierSayur.id,
      sku: "MKN-KRIPIK",
      barcode: "8991003000001",
      name: "Keripik Singkong",
      unit: "pcs",
      productType: "SIMPLE",
      buyPrice: 5000,
      sellPrice: 8000,
      avgCost: 0,
      stock: 0,
      minStock: 8,
    },
  });

  const mieInstan = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catMakanan.id,
      supplierId: supplierSayur.id,
      sku: "MKN-MIE",
      barcode: "8991003000002",
      name: "Mie Instan",
      unit: "pcs",
      productType: "SIMPLE",
      buyPrice: 3000,
      sellPrice: 5000,
      avgCost: 0,
      stock: 0,
      minStock: 15,
    },
  });

  const snackMix = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catMakanan.id,
      sku: "MKN-SNACK",
      barcode: "8991003000003",
      name: "Snack Mix",
      unit: "pcs",
      productType: "SIMPLE",
      buyPrice: 4000,
      sellPrice: 7000,
      avgCost: 0,
      stock: 0,
      minStock: 5,
    },
  });

  const nasiGoreng = await prisma.product.create({
    data: {
      tenantId,
      outletId: outlet.id,
      categoryId: catMakanan.id,
      sku: "MKN-NASGOR",
      barcode: "8991003000004",
      name: "Nasi Goreng",
      unit: "porsi",
      productType: "RECIPE",
      buyPrice: 0,
      sellPrice: 20000,
      avgCost: 0,
      stock: 0,
      minStock: 0,
    },
  });

  await prisma.recipeItem.createMany({
    data: [
      {
        tenantId,
        productId: nasiGoreng.id,
        ingredientId: beras.id,
        quantity: 0.2,
        unit: "kg",
      },
      {
        tenantId,
        productId: nasiGoreng.id,
        ingredientId: telur.id,
        quantity: 1,
        unit: "butir",
      },
    ],
  });

  const purchaseItems = [
    { product: beras, quantity: 20, unitCost: 11000 },
    { product: telur, quantity: 60, unitCost: 1800 },
    { product: airMineral, quantity: 48, unitCost: 2500 },
    { product: kopiSachet, quantity: 40, unitCost: 1500 },
    { product: keripik, quantity: 24, unitCost: 5000 },
    { product: mieInstan, quantity: 36, unitCost: 3000 },
    { product: snackMix, quantity: 20, unitCost: 4000 },
  ] as const;

  const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const purchase = await prisma.purchase.create({
    data: {
      tenantId,
      outletId: outlet.id,
      supplierId: supplierUtama.id,
      invoiceNo: "PO-DEMO-001",
      purchasedAt: dateOnly(3),
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: purchaseTotal,
      documentStatus: "RECEIVED",
      paymentStatus: "PAID",
      notes: "Pembelian awal demo",
      createdById: owner.id,
      receivedAt: daysAgo(3),
      items: {
        create: purchaseItems.map((item) => ({
          tenantId,
          productId: item.product.id,
          quantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal: item.quantity * item.unitCost,
        })),
      },
    },
  });

  for (const item of purchaseItems) {
    await prisma.product.update({
      where: { id: item.product.id },
      data: {
        stock: item.quantity,
        avgCost: item.unitCost,
        buyPrice: item.unitCost,
      },
    });
    await prisma.stockMovement.create({
      data: {
        tenantId,
        outletId: outlet.id,
        productId: item.product.id,
        movementType: "PURCHASE",
        quantity: item.quantity,
        stockBefore: 0,
        stockAfter: item.quantity,
        unitCost: item.unitCost,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        notes: "Seed demo pembelian",
        createdById: owner.id,
        createdAt: daysAgo(3),
      },
    });
  }

  // Adjust one product slightly for inventory history
  await prisma.product.update({
    where: { id: snackMix.id },
    data: { stock: 18 },
  });
  await prisma.stockMovement.create({
    data: {
      tenantId,
      outletId: outlet.id,
      productId: snackMix.id,
      movementType: "ADJUSTMENT_OUT",
      quantity: 2,
      stockBefore: 20,
      stockAfter: 18,
      referenceType: "ADJUSTMENT",
      notes: "Rusak ringkas (demo)",
      createdById: owner.id,
      createdAt: daysAgo(2),
    },
  });

  const closedSession = await prisma.cashierSession.create({
    data: {
      tenantId,
      outletId: outlet.id,
      openedById: owner.id,
      closedById: owner.id,
      openingCash: 100000,
      closingCash: 175000,
      openedAt: daysAgo(1),
      closedAt: daysAgo(1),
      status: "CLOSED",
    },
  });

  // Sale 1: SIMPLE items
  const sale1Subtotal = 4000 * 2 + 8000; // air x2 + keripik
  const sale1 = await prisma.sale.create({
    data: {
      tenantId,
      outletId: outlet.id,
      cashierSessionId: closedSession.id,
      cashierId: owner.id,
      customerId: custAndi.id,
      receiptNo: "RCPT-DEMO-001",
      soldAt: daysAgo(1),
      subtotal: sale1Subtotal,
      discountAmount: 0,
      taxAmount: 0,
      totalNet: sale1Subtotal,
      status: "COMPLETED",
      items: {
        create: [
          {
            tenantId,
            productId: airMineral.id,
            productNameSnapshot: airMineral.name,
            quantity: 2,
            unitPrice: 4000,
            discountAmount: 0,
            lineTotal: 8000,
            cogsAmount: 2500 * 2,
          },
          {
            tenantId,
            productId: keripik.id,
            productNameSnapshot: keripik.name,
            quantity: 1,
            unitPrice: 8000,
            discountAmount: 0,
            lineTotal: 8000,
            cogsAmount: 5000,
          },
        ],
      },
      payments: {
        create: [{ tenantId, method: "CASH", amount: sale1Subtotal }],
      },
    },
  });

  // Sale 2: RECIPE nasi goreng x2
  const sale2Qty = 2;
  const sale2Subtotal = 20000 * sale2Qty;
  const sale2Cogs = (11000 * 0.2 + 1800 * 1) * sale2Qty;
  const sale2 = await prisma.sale.create({
    data: {
      tenantId,
      outletId: outlet.id,
      cashierSessionId: closedSession.id,
      cashierId: cashier.id,
      customerId: custSiti.id,
      receiptNo: "RCPT-DEMO-002",
      soldAt: daysAgo(1),
      subtotal: sale2Subtotal,
      discountAmount: 2000,
      taxAmount: 0,
      totalNet: sale2Subtotal - 2000,
      status: "COMPLETED",
      items: {
        create: [
          {
            tenantId,
            productId: nasiGoreng.id,
            productNameSnapshot: nasiGoreng.name,
            quantity: sale2Qty,
            unitPrice: 20000,
            discountAmount: 2000,
            lineTotal: sale2Subtotal - 2000,
            cogsAmount: sale2Cogs,
            recipeSnapshot: [
              { ingredientId: beras.id, quantity: 0.2 },
              { ingredientId: telur.id, quantity: 1 },
            ],
          },
        ],
      },
      payments: {
        create: [{ tenantId, method: "QRIS", amount: sale2Subtotal - 2000 }],
      },
    },
  });

  // Apply stock deductions for closed sales
  const stockDeltas: Array<{
    productId: string;
    qty: number;
    movementType: string;
    unitCost: number;
    referenceId: string;
  }> = [
    { productId: airMineral.id, qty: 2, movementType: "SALE", unitCost: 2500, referenceId: sale1.id },
    { productId: keripik.id, qty: 1, movementType: "SALE", unitCost: 5000, referenceId: sale1.id },
    { productId: beras.id, qty: 0.4, movementType: "SALE", unitCost: 11000, referenceId: sale2.id },
    { productId: telur.id, qty: 2, movementType: "SALE", unitCost: 1800, referenceId: sale2.id },
  ];

  for (const delta of stockDeltas) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: delta.productId } });
    const before = Number(product.stock);
    const after = before - delta.qty;
    await prisma.product.update({ where: { id: delta.productId }, data: { stock: after } });
    await prisma.stockMovement.create({
      data: {
        tenantId,
        outletId: outlet.id,
        productId: delta.productId,
        movementType: delta.movementType,
        quantity: delta.qty,
        stockBefore: before,
        stockAfter: after,
        unitCost: delta.unitCost,
        referenceType: "SALE",
        referenceId: delta.referenceId,
        createdById: owner.id,
        createdAt: daysAgo(1),
      },
    });
  }

  // Open cashier session ready for Kasir menu
  await prisma.cashierSession.create({
    data: {
      tenantId,
      outletId: outlet.id,
      openedById: owner.id,
      openingCash: 150000,
      openedAt: new Date(),
      status: "OPEN",
    },
  });

  // Sale today on open session (kopi)
  const openSession = await prisma.cashierSession.findFirstOrThrow({
    where: { tenantId, status: "OPEN" },
  });
  const sale3Subtotal = 5000 * 3;
  const sale3 = await prisma.sale.create({
    data: {
      tenantId,
      outletId: outlet.id,
      cashierSessionId: openSession.id,
      cashierId: owner.id,
      customerId: custBudi.id,
      receiptNo: "RCPT-DEMO-003",
      soldAt: new Date(),
      subtotal: sale3Subtotal,
      discountAmount: 0,
      taxAmount: 0,
      totalNet: sale3Subtotal,
      status: "COMPLETED",
      items: {
        create: [
          {
            tenantId,
            productId: kopiSachet.id,
            productNameSnapshot: kopiSachet.name,
            quantity: 3,
            unitPrice: 5000,
            discountAmount: 0,
            lineTotal: sale3Subtotal,
            cogsAmount: 1500 * 3,
          },
        ],
      },
      payments: {
        create: [{ tenantId, method: "CASH", amount: sale3Subtotal }],
      },
    },
  });

  {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: kopiSachet.id } });
    const before = Number(product.stock);
    const after = before - 3;
    await prisma.product.update({ where: { id: kopiSachet.id }, data: { stock: after } });
    await prisma.stockMovement.create({
      data: {
        tenantId,
        outletId: outlet.id,
        productId: kopiSachet.id,
        movementType: "SALE",
        quantity: 3,
        stockBefore: before,
        stockAfter: after,
        unitCost: 1500,
        referenceType: "SALE",
        referenceId: sale3.id,
        createdById: owner.id,
      },
    });
  }

  const listrik = await prisma.expenseCategory.findFirst({
    where: { tenantId, name: "listrik" },
  });
  const internet = await prisma.expenseCategory.findFirst({
    where: { tenantId, name: "internet" },
  });
  const transportasi = await prisma.expenseCategory.findFirst({
    where: { tenantId, name: "transportasi" },
  });
  if (!listrik || !internet || !transportasi) {
    throw new Error("Expense category sistem tidak lengkap.");
  }

  await prisma.expense.createMany({
    data: [
      {
        tenantId,
        outletId: outlet.id,
        categoryId: listrik.id,
        description: "Token listrik toko",
        amount: 150000,
        expenseDate: dateOnly(2),
        paymentMethod: "TRANSFER",
        createdById: owner.id,
      },
      {
        tenantId,
        outletId: outlet.id,
        categoryId: internet.id,
        description: "Paket internet bulanan",
        amount: 275000,
        expenseDate: dateOnly(5),
        paymentMethod: "TRANSFER",
        createdById: owner.id,
      },
      {
        tenantId,
        outletId: outlet.id,
        categoryId: transportasi.id,
        description: "Ongkir belanja bahan",
        amount: 35000,
        expenseDate: dateOnly(1),
        paymentMethod: "CASH",
        createdById: owner.id,
      },
    ],
  });

  const counts = {
    products: await prisma.product.count({ where: { tenantId } }),
    categories: await prisma.category.count({ where: { tenantId } }),
    customers: await prisma.customer.count({ where: { tenantId } }),
    suppliers: await prisma.supplier.count({ where: { tenantId } }),
    sales: await prisma.sale.count({ where: { tenantId } }),
    purchases: await prisma.purchase.count({ where: { tenantId } }),
    expenses: await prisma.expense.count({ where: { tenantId } }),
    stockMovements: await prisma.stockMovement.count({ where: { tenantId } }),
    cashierSessions: await prisma.cashierSession.count({ where: { tenantId } }),
    users: await prisma.user.count({ where: { tenantId, deletedAt: null } }),
  };

  console.log("Seed demo selesai.");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Login owner: ${DEMO_OWNER_EMAIL}`);
  console.log(`Login kasir: ${DEMO_CASHIER_EMAIL} / password12`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
