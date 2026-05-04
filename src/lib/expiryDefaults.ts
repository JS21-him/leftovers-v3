const EXPIRY_DAYS: Record<string, number> = {
  produce: 5,
  dairy: 7,
  meat: 3,
  frozen: 90,
  beverages: 14,
  pantry: 180,
  other: 7,
};

export function getExpiryDate(category: string): string {
  const days = EXPIRY_DAYS[category] ?? EXPIRY_DAYS.other;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
