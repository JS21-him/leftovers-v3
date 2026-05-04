export interface Profile {
  id: string;
  display_name: string | null;
  household_id: string | null;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  dietary_restrictions: string[];
}

export interface FridgeItem {
  id: string;
  household_id: string;
  added_by: string | null;
  name: string;
  quantity: string | null;
  expiry_date: string | null;
  barcode: string | null;
  category: string | null;
  created_at: string;
}

export interface Staple {
  id: string;
  household_id: string;
  name: string;
  default_quantity: string | null;
  reorder_when_low: boolean;
  created_at: string;
  last_checked_at: string | null;
}

export interface ShoppingListItem {
  id: string;
  household_id: string;
  added_by: string | null;
  name: string;
  quantity: string | null;
  is_bought: boolean;
  is_staple: boolean;
  created_at: string;
}

export interface SavedRecipe {
  id: string;
  household_id: string;
  title: string;
  ingredients: string[];
  instructions: string | null;
  created_at: string;
}

export interface ReorderHistory {
  id: string;
  household_id: string;
  item_name: string;
  reordered_at: string;
}
