import { Inject, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../auth/tokens.js";
import { AppError } from "../common/app-error.js";
import { jakartaDayEndExclusive, jakartaDayStart } from "../common/dates.js";
import { asNumber, roundMoney } from "../common/money.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async summary(currentUser: JwtPayload, from: string, to: string) {
    const start = jakartaDayStart(from);
    const end = jakartaDayEndExclusive(to);
    const tid = currentUser.tid;

    const sales = await this.prisma.sale.findMany({
      where: { tenantId: tid, status: "COMPLETED", soldAt: { gte: start, lt: end } },
      include: { items: true, payments: true },
    });
    const purchases = await this.prisma.purchase.findMany({
      where: { tenantId: tid, purchasedAt: { gte: start, lt: end } },
      include: { items: true, supplier: true },
    });
    const expenses = await this.prisma.expense.findMany({
      where: { tenantId: tid, deletedAt: null, expenseDate: { gte: start, lt: end } },
      include: { category: true },
    });
    const products = await this.prisma.product.findMany({
      where: { tenantId: tid, deletedAt: null },
    });
    const movements = await this.prisma.stockMovement.findMany({
      where: { tenantId: tid, createdAt: { gte: start, lt: end } },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });

    const revenue = roundMoney(sales.reduce((sum, sale) => sum + asNumber(sale.totalNet), 0));
    const cogs = roundMoney(sales.reduce((sum, sale) => sum + sale.items.reduce((line, item) => line + asNumber(item.cogsAmount), 0), 0));
    const grossProfit = roundMoney(revenue - cogs);
    const expenseTotal = roundMoney(expenses.reduce((sum, row) => sum + asNumber(row.amount), 0));
    const netProfit = roundMoney(grossProfit - expenseTotal);
    const cashIn = roundMoney(sales.reduce((sum, sale) => sum + sale.payments.reduce((line, pay) => line + asNumber(pay.amount), 0), 0));
    const paidPurchases = purchases.filter((row) => row.paymentStatus === "PAID");
    const cashOut = roundMoney(expenseTotal + paidPurchases.reduce((sum, row) => sum + asNumber(row.totalAmount), 0));

    const productMap = new Map<string, { name: string; qty: number; revenue: number; cogs: number }>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const current = productMap.get(item.productId) ?? { name: item.productNameSnapshot, qty: 0, revenue: 0, cogs: 0 };
        current.qty += asNumber(item.quantity);
        current.revenue += asNumber(item.lineTotal);
        current.cogs += asNumber(item.cogsAmount);
        productMap.set(item.productId, current);
      }
    }

    const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const lowStock = products
      .filter((product) => product.productType !== "RECIPE" && asNumber(product.stock) <= asNumber(product.minStock))
      .map((product) => ({ id: product.id, name: product.name, stock: asNumber(product.stock), minStock: asNumber(product.minStock) }));

    return {
      from,
      to,
      dashboard: {
        revenue,
        cogs,
        grossProfit,
        expense: expenseTotal,
        netProfit,
        transactionCount: sales.length,
        topProducts,
        lowStock,
      },
      profitLoss: { revenue, cogs, grossProfit, expense: expenseTotal, netProfit },
      cashFlow: { cashIn, cashOut, net: roundMoney(cashIn - cashOut) },
      sales: sales.map((sale) => ({
        id: sale.id,
        receiptNo: sale.receiptNo,
        soldAt: sale.soldAt.toISOString(),
        totalNet: asNumber(sale.totalNet),
        methods: sale.payments.map((pay) => pay.method),
      })),
      purchases: purchases.map((row) => ({
        id: row.id,
        invoiceNo: row.invoiceNo,
        supplier: row.supplier.name,
        totalAmount: asNumber(row.totalAmount),
        documentStatus: row.documentStatus,
      })),
      inventory: {
        valuation: roundMoney(products.reduce((sum, product) => sum + asNumber(product.stock) * asNumber(product.avgCost), 0)),
        movements: movements.slice(0, 100).map((row) => ({
          id: row.id,
          productName: row.product.name,
          movementType: row.movementType,
          quantity: asNumber(row.quantity),
          createdAt: row.createdAt.toISOString(),
        })),
      },
      productProfitability: [...productMap.values()].map((row) => ({
        ...row,
        profit: roundMoney(row.revenue - row.cogs),
        margin: row.revenue === 0 ? 0 : roundMoney(((row.revenue - row.cogs) / row.revenue) * 100),
      })),
    };
  }

  async export(currentUser: JwtPayload, type: string, from: string, to: string, format: string) {
    const data = await this.summary(currentUser, from, to);
    const rows = this.rowsFor(type, data);
    if (rows.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Tipe laporan tidak dikenal.", 400);
    }
    if (format === "pdf") {
      return { filename: `${type}.pdf`, contentType: "application/pdf", body: this.toPdf(type, rows) };
    }
    return { filename: `${type}.csv`, contentType: "text/csv; charset=utf-8", body: this.toCsv(rows) };
  }

  private rowsFor(type: string, data: Awaited<ReturnType<ReportsService["summary"]>>) {
    switch (type) {
      case "sales":
        return [["No", "Waktu", "Total", "Metode"], ...data.sales.map((row) => [row.receiptNo, row.soldAt, String(row.totalNet), row.methods.join("/")])];
      case "purchases":
        return [["Invoice", "Supplier", "Total", "Status"], ...data.purchases.map((row) => [row.invoiceNo, row.supplier, String(row.totalAmount), row.documentStatus])];
      case "inventory":
        return [["Produk", "Tipe", "Qty", "Waktu"], ...data.inventory.movements.map((row) => [row.productName, row.movementType, String(row.quantity), row.createdAt])];
      case "profit-loss":
        return [["Metrik", "Nilai"], ["Revenue", String(data.profitLoss.revenue)], ["HPP", String(data.profitLoss.cogs)], ["Laba kotor", String(data.profitLoss.grossProfit)], ["Biaya", String(data.profitLoss.expense)], ["Laba bersih", String(data.profitLoss.netProfit)]];
      case "product-profitability":
        return [["Produk", "Qty", "Omzet", "HPP", "Laba", "Margin"], ...data.productProfitability.map((row) => [row.name, String(row.qty), String(row.revenue), String(row.cogs), String(row.profit), String(row.margin)])];
      case "cash-flow":
        return [["Arah", "Nilai"], ["Masuk", String(data.cashFlow.cashIn)], ["Keluar", String(data.cashFlow.cashOut)], ["Net", String(data.cashFlow.net)]];
      default:
        return [];
    }
  }

  private toCsv(rows: string[][]) {
    return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  }

  private toPdf(title: string, rows: string[][]) {
    const lines = [title, ...rows.map((row) => row.join(" | "))];
    const escaped = lines.map((line) => line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")).join("\\n");
    const stream = `BT /F1 11 Tf 48 750 Td (${escaped}) Tj ET`;
    return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
trailer << /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;
  }
}
