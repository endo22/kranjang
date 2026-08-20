export type CashierProduct = {
  id: string;
  name: string;
  sellPrice: number;
  productType: string;
  barcode: string | null;
  isActive: boolean;
  categoryId: string | null;
};

export type CashierCartItem = {
  product: CashierProduct;
  quantity: number;
};

export type CashierSettingsPreview = {
  taxPercent: string;
  taxInclusive: boolean;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function filterProducts(products: CashierProduct[], query: string, categoryFilter: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    if (!product.isActive) {
      return false;
    }
    if (categoryFilter && product.categoryId !== categoryFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    return (
      product.name.toLowerCase().includes(normalizedQuery) ||
      (product.barcode?.includes(query.trim()) ?? false)
    );
  });
}

export function pickProductForEnter(products: CashierProduct[], filtered: CashierProduct[], query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return null;
  }

  const exactBarcode = products.filter((product) => product.isActive && product.barcode === normalizedQuery);
  const pool = exactBarcode.length === 1 ? exactBarcode : filtered;
  return pool.length === 1 ? pool[0] : null;
}

export function addCartItem(cart: CashierCartItem[], product: CashierProduct) {
  const existing = cart.find((item) => item.product.id === product.id);
  if (!existing) {
    return [...cart, { product, quantity: 1 }];
  }

  return cart.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
}

export function estimateSaleTotals(cart: CashierCartItem[], discountAmount: number, settings: CashierSettingsPreview) {
  const subtotal = roundMoney(cart.reduce((sum, item) => sum + item.product.sellPrice * item.quantity, 0));
  const safeDiscount = roundMoney(Math.max(0, discountAmount || 0));
  const afterDiscount = roundMoney(Math.max(0, subtotal - safeDiscount));
  const taxPercent = Number(settings.taxPercent) || 0;
  const taxAmount = settings.taxInclusive
    ? roundMoney(afterDiscount - afterDiscount / (1 + taxPercent / 100))
    : roundMoney(afterDiscount * (taxPercent / 100));
  const totalNet = settings.taxInclusive ? afterDiscount : roundMoney(afterDiscount + taxAmount);

  return {
    subtotal,
    discountAmount: safeDiscount,
    taxAmount,
    totalNet,
  };
}
