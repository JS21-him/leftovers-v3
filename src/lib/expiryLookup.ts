export interface ExpiryEntry {
  days: number;
  explanation: string;
}

const EXPIRY_TABLE: Record<string, ExpiryEntry> = {
  // Dairy
  'milk': { days: 7, explanation: 'Milk keeps about a week in the fridge.' },
  'whole milk': { days: 7, explanation: 'Whole milk keeps about a week refrigerated.' },
  'skim milk': { days: 7, explanation: 'Skim milk keeps about a week refrigerated.' },
  'butter': { days: 30, explanation: 'Butter keeps 3–4 weeks in the fridge.' },
  'cheese': { days: 21, explanation: 'Hard cheese keeps 3–4 weeks once opened.' },
  'cheddar': { days: 21, explanation: 'Cheddar keeps 3–4 weeks once opened.' },
  'mozzarella': { days: 5, explanation: 'Fresh mozzarella keeps about 5 days.' },
  'parmesan': { days: 30, explanation: 'Parmesan keeps about a month refrigerated.' },
  'cream cheese': { days: 10, explanation: 'Cream cheese keeps 1–2 weeks once opened.' },
  'sour cream': { days: 14, explanation: 'Sour cream keeps 1–2 weeks once opened.' },
  'yogurt': { days: 10, explanation: 'Yogurt keeps 1–2 weeks past the sell-by date.' },
  'greek yogurt': { days: 10, explanation: 'Greek yogurt keeps 1–2 weeks past the sell-by date.' },
  'heavy cream': { days: 10, explanation: 'Heavy cream keeps about 10 days once opened.' },
  'whipping cream': { days: 10, explanation: 'Whipping cream keeps about 10 days once opened.' },
  'eggs': { days: 21, explanation: 'Eggs keep about 3 weeks refrigerated.' },
  // Meat
  'chicken': { days: 2, explanation: 'Raw chicken keeps 1–2 days in the fridge.' },
  'chicken breast': { days: 2, explanation: 'Raw chicken keeps 1–2 days in the fridge.' },
  'chicken thighs': { days: 2, explanation: 'Raw chicken keeps 1–2 days in the fridge.' },
  'ground beef': { days: 2, explanation: 'Ground beef keeps 1–2 days in the fridge.' },
  'beef': { days: 3, explanation: 'Raw beef keeps 3–5 days in the fridge.' },
  'pork': { days: 3, explanation: 'Raw pork keeps 3–5 days in the fridge.' },
  'bacon': { days: 7, explanation: 'Opened bacon keeps about a week in the fridge.' },
  'sausage': { days: 4, explanation: 'Fresh sausage keeps 3–5 days in the fridge.' },
  'salmon': { days: 2, explanation: 'Fresh salmon keeps 1–2 days in the fridge.' },
  'fish': { days: 2, explanation: 'Fresh fish keeps 1–2 days in the fridge.' },
  'tuna steak': { days: 2, explanation: 'Fresh tuna keeps 1–2 days in the fridge.' },
  'shrimp': { days: 2, explanation: 'Fresh shrimp keeps 1–2 days in the fridge.' },
  // Produce
  'lettuce': { days: 7, explanation: 'Lettuce keeps about a week in the fridge.' },
  'spinach': { days: 5, explanation: 'Spinach keeps 3–5 days refrigerated.' },
  'kale': { days: 7, explanation: 'Kale keeps about a week in the fridge.' },
  'broccoli': { days: 5, explanation: 'Broccoli keeps 3–5 days in the fridge.' },
  'carrots': { days: 14, explanation: 'Carrots keep 2–3 weeks refrigerated.' },
  'celery': { days: 14, explanation: 'Celery keeps 1–2 weeks in the fridge.' },
  'cucumber': { days: 7, explanation: 'Cucumbers keep about a week refrigerated.' },
  'tomato': { days: 5, explanation: 'Tomatoes keep 3–5 days refrigerated once ripe.' },
  'tomatoes': { days: 5, explanation: 'Tomatoes keep 3–5 days refrigerated once ripe.' },
  'bell pepper': { days: 7, explanation: 'Bell peppers keep about a week in the fridge.' },
  'onion': { days: 30, explanation: 'Onions keep about a month stored properly.' },
  'garlic': { days: 30, explanation: 'Garlic keeps about a month refrigerated.' },
  'avocado': { days: 3, explanation: 'Ripe avocado keeps 3–5 days in the fridge.' },
  'lemon': { days: 21, explanation: 'Lemons keep 2–3 weeks in the fridge.' },
  'lime': { days: 14, explanation: 'Limes keep 1–2 weeks in the fridge.' },
  'strawberries': { days: 5, explanation: 'Strawberries keep 3–5 days in the fridge.' },
  'blueberries': { days: 10, explanation: 'Blueberries keep about 10 days refrigerated.' },
  'raspberries': { days: 3, explanation: 'Raspberries keep 2–3 days in the fridge.' },
  'grapes': { days: 7, explanation: 'Grapes keep about a week refrigerated.' },
  'apple': { days: 30, explanation: 'Apples keep 4–6 weeks in the fridge.' },
  'apples': { days: 30, explanation: 'Apples keep 4–6 weeks in the fridge.' },
  'banana': { days: 5, explanation: 'Ripe bananas keep 3–5 days in the fridge (skin darkens).' },
  'bananas': { days: 5, explanation: 'Ripe bananas keep 3–5 days in the fridge (skin darkens).' },
  'mango': { days: 5, explanation: 'Ripe mango keeps 4–5 days in the fridge.' },
  'mushrooms': { days: 7, explanation: 'Mushrooms keep about a week refrigerated.' },
  'zucchini': { days: 7, explanation: 'Zucchini keeps about a week in the fridge.' },
  'asparagus': { days: 4, explanation: 'Asparagus keeps 3–4 days in the fridge.' },
  // Cooked / prepared
  'cooked chicken': { days: 4, explanation: 'Cooked chicken keeps 3–4 days in the fridge.' },
  'leftover rice': { days: 4, explanation: 'Cooked rice keeps 4 days in the fridge.' },
  'cooked pasta': { days: 5, explanation: 'Cooked pasta keeps 3–5 days in the fridge.' },
  'soup': { days: 4, explanation: 'Soup keeps 3–4 days in the fridge.' },
  'stew': { days: 4, explanation: 'Stew keeps 3–4 days in the fridge.' },
  'leftover pizza': { days: 4, explanation: 'Leftover pizza keeps 3–4 days in the fridge.' },
  // Deli
  'deli meat': { days: 5, explanation: 'Opened deli meat keeps 3–5 days in the fridge.' },
  'ham': { days: 5, explanation: 'Opened ham keeps 3–5 days in the fridge.' },
  'turkey slices': { days: 5, explanation: 'Deli turkey keeps 3–5 days in the fridge.' },
  'salami': { days: 14, explanation: 'Opened salami keeps 1–2 weeks in the fridge.' },
  // Bread / bakery
  'bread': { days: 7, explanation: 'Bread keeps about a week in the fridge.' },
  'sliced bread': { days: 7, explanation: 'Sliced bread keeps about a week in the fridge.' },
  'bagels': { days: 5, explanation: 'Bagels keep about 5 days in the fridge.' },
  'tortillas': { days: 7, explanation: 'Flour tortillas keep about a week in the fridge.' },
  // Other fridge staples
  'orange juice': { days: 7, explanation: 'Opened OJ keeps about a week in the fridge.' },
  'milk alternative': { days: 10, explanation: 'Opened milk alternative keeps 7–10 days.' },
  'almond milk': { days: 10, explanation: 'Opened almond milk keeps 7–10 days.' },
  'oat milk': { days: 10, explanation: 'Opened oat milk keeps 7–10 days.' },
  'tofu': { days: 5, explanation: 'Opened tofu keeps 3–5 days submerged in water, refrigerated.' },
  'hummus': { days: 7, explanation: 'Hummus keeps about a week in the fridge.' },
  'salsa': { days: 7, explanation: 'Opened salsa keeps about a week in the fridge.' },
  'pasta sauce': { days: 5, explanation: 'Opened pasta sauce keeps 3–5 days in the fridge.' },
  'opened wine': { days: 5, explanation: 'Opened wine keeps 3–5 days sealed in the fridge.' },
};

export function lookupExpiry(name: string): ExpiryEntry | null {
  const normalized = name.toLowerCase().trim();
  return EXPIRY_TABLE[normalized] ?? null;
}

export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
