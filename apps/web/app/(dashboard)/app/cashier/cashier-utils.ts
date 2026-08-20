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

export type CashierShortcutAction = "focusSearch" | "pay" | "hold" | "restore" | "qtyUp" | "qtyDown";

export function resolveCashierShortcut(input: {
  key: string;
  targetTagName?: string;
}): CashierShortcutAction | null {
  const key = input.key;
  if (key === "F2") {
    return "focusSearch";
  }
  if (key === "F4") {
    return "pay";
  }
  if (key === "F8") {
    return "hold";
  }
  if (key === "F9") {
    return "restore";
  }

  const isTyping = input.targetTagName === "INPUT" || input.targetTagName === "TEXTAREA" || input.targetTagName === "SELECT";
  if (isTyping) {
    return null;
  }
  if (key === "+" || key === "=") {
    return "qtyUp";
  }
  if (key === "-" || key === "_") {
    return "qtyDown";
  }
  return null;
}

export function adjustLastCartQty(cart: CashierCartItem[], delta: number) {
  if (cart.length === 0) {
    return cart;
  }
  const lastIndex = cart.length - 1;
  return cart
    .map((item, index) => {
      if (index !== lastIndex) {
        return item;
      }
      return { ...item, quantity: item.quantity + delta };
    })
    .filter((item) => item.quantity > 0);
}

export const MAX_HELD_CARTS = 3;

export type HeldCart = {
  id: string;
  label: string;
  items: CashierCartItem[];
  discount: string;
  customerId: string;
  savedAt: string;
};

export function holdsStorageKey(sessionId: string) {
  return `kranjang.cashier.holds.${sessionId}`;
}

export function loadHeldCarts(sessionId: string, storage: Pick<Storage, "getItem"> = sessionStorage): HeldCart[] {
  try {
    const raw = storage.getItem(holdsStorageKey(sessionId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as HeldCart[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HELD_CARTS) : [];
  } catch {
    return [];
  }
}

export function saveHeldCarts(sessionId: string, holds: HeldCart[], storage: Pick<Storage, "setItem"> = sessionStorage) {
  storage.setItem(holdsStorageKey(sessionId), JSON.stringify(holds.slice(0, MAX_HELD_CARTS)));
}

export function clearHeldCarts(sessionId: string, storage: Pick<Storage, "removeItem"> = sessionStorage) {
  storage.removeItem(holdsStorageKey(sessionId));
}

export function buildHeldCart(input: {
  items: CashierCartItem[];
  discount: string;
  customerId: string;
  labelIndex: number;
  now?: Date;
}): HeldCart | { error: string } {
  if (input.items.length === 0) {
    return { error: "Keranjang kosong." };
  }
  const now = input.now ?? new Date();
  return {
    id: `hold-${now.getTime()}-${input.labelIndex}`,
    label: `Tahan ${input.labelIndex}`,
    items: input.items,
    discount: input.discount,
    customerId: input.customerId,
    savedAt: now.toISOString(),
  };
}

export function holdActiveCart(holds: HeldCart[], draft: {
  items: CashierCartItem[];
  discount: string;
  customerId: string;
}): { holds: HeldCart[]; error?: string } {
  if (draft.items.length === 0) {
    return { holds, error: "Keranjang kosong." };
  }
  if (holds.length >= MAX_HELD_CARTS) {
    return { holds, error: `Maksimal ${MAX_HELD_CARTS} keranjang ditahan.` };
  }
  const built = buildHeldCart({
    items: draft.items,
    discount: draft.discount,
    customerId: draft.customerId,
    labelIndex: holds.length + 1,
  });
  if ("error" in built) {
    return { holds, error: built.error };
  }
  return { holds: [...holds, built] };
}
