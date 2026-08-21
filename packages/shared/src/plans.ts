export const SUBSCRIPTION_PLANS_SEED = [
  { code: "trial", name: "Free Trial", priceMonthly: 0, durationDays: 30, maxOutlets: 1, featureReports: true, featureInventory: true, featureMultiOutlet: false, featureExport: false },
  { code: "basic", name: "Basic", priceMonthly: 49000, durationDays: 30, maxOutlets: 1, featureReports: true, featureInventory: true, featureMultiOutlet: false, featureExport: false },
  { code: "business", name: "Business", priceMonthly: 99000, durationDays: 30, maxOutlets: 3, featureReports: true, featureInventory: true, featureMultiOutlet: true, featureExport: true },
  { code: "pro", name: "Pro", priceMonthly: 199000, durationDays: 30, maxOutlets: 5, featureReports: true, featureInventory: true, featureMultiOutlet: true, featureExport: true },
] as const;

export const PLAN_CARDS = SUBSCRIPTION_PLANS_SEED.filter((p) => p.code !== "trial").map((p) => ({
  code: p.code,
  name: p.name,
  priceMonthly: p.priceMonthly,
}));
