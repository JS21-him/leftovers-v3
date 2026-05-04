# AI Expiry Prediction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user types an item name in the "Add to Fridge" modal, the expiry date field auto-fills instantly (lookup table) or after ~1s (Claude edge function fallback), eliminating the need to type it manually.

**Architecture:** Client-side lookup table (`expiryLookup.ts`) covers ~80 common foods with zero latency. Unknown items trigger a `predict-expiry` Supabase edge function that calls Claude Haiku. The `useExpiryPrediction` hook manages the 500ms debounce and hybrid routing. `AddFridgeItemModal` replaces its plain text input with a smart field that shows the AI badge, explanation, and a tap-to-edit pencil.

**Tech Stack:** React Native, Expo SDK 54, TypeScript strict, Supabase Edge Functions (Deno), Claude Haiku (`claude-haiku-4-5-20251001`), Jest / jest-expo

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/lib/expiryLookup.ts` |
| Create | `src/__tests__/lib/expiryLookup.test.ts` |
| Create | `supabase/functions/predict-expiry/index.ts` |
| Create | `src/features/fridge/useExpiryPrediction.ts` |
| Create | `src/__tests__/features/fridge/useExpiryPrediction.test.ts` |
| Modify | `src/features/fridge/AddFridgeItemModal.tsx` |

---

## Task 1: expiryLookup.ts — client-side lookup table

**Files:**
- Create: `src/lib/expiryLookup.ts`
- Test: `src/__tests__/lib/expiryLookup.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/expiryLookup.test.ts`:

```typescript
/**
 * @jest-environment node
 */
/// <reference types="jest" />

import { lookupExpiry, daysFromNow } from '../../lib/expiryLookup';

function expectedDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

describe('lookupExpiry', () => {
  it('returns entry for milk (7 days)', () => {
    const result = lookupExpiry('milk');
    expect(result).not.toBeNull();
    expect(result!.days).toBe(7);
    expect(result!.explanation.length).toBeGreaterThan(0);
  });

  it('returns entry for chicken breast (2 days)', () => {
    const result = lookupExpiry('chicken breast');
    expect(result).not.toBeNull();
    expect(result!.days).toBe(2);
  });

  it('returns entry for eggs (21 days)', () => {
    expect(lookupExpiry('eggs')!.days).toBe(21);
  });

  it('normalises uppercase input', () => {
    expect(lookupExpiry('Milk')).not.toBeNull();
    expect(lookupExpiry('EGGS')).not.toBeNull();
    expect(lookupExpiry('Chicken Breast')).not.toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(lookupExpiry('  milk  ')).not.toBeNull();
  });

  it('returns null for empty string', () => {
    expect(lookupExpiry('')).toBeNull();
  });

  it('returns null for unknown items', () => {
    expect(lookupExpiry('homemade kimchi')).toBeNull();
    expect(lookupExpiry('unicorn meat')).toBeNull();
  });

  it('returns entry for greek yogurt (10 days)', () => {
    expect(lookupExpiry('greek yogurt')!.days).toBe(10);
  });

  it('returns entry for cooked chicken (4 days)', () => {
    expect(lookupExpiry('cooked chicken')!.days).toBe(4);
  });

  it('returns entry for hummus (7 days)', () => {
    expect(lookupExpiry('hummus')!.days).toBe(7);
  });

  it('returns entry for strawberries (5 days)', () => {
    expect(lookupExpiry('strawberries')!.days).toBe(5);
  });

  it('all spot-checked entries have a non-empty explanation', () => {
    const items = ['milk', 'chicken breast', 'eggs', 'bread', 'salmon', 'avocado', 'tofu'];
    for (const item of items) {
      expect(lookupExpiry(item)!.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe('daysFromNow', () => {
  it('returns a YYYY-MM-DD string N days from today', () => {
    expect(daysFromNow(7)).toBe(expectedDate(7));
    expect(daysFromNow(2)).toBe(expectedDate(2));
    expect(daysFromNow(30)).toBe(expectedDate(30));
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx jest src/__tests__/lib/expiryLookup.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../lib/expiryLookup'`

- [ ] **Step 3: Create `src/lib/expiryLookup.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

```
npx jest src/__tests__/lib/expiryLookup.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/expiryLookup.ts src/__tests__/lib/expiryLookup.test.ts
git commit -m "feat: add client-side food expiry lookup table"
```

---

## Task 2: predict-expiry edge function

**Files:**
- Create: `supabase/functions/predict-expiry/index.ts`

No unit tests — edge functions are Deno runtime; manual integration test at the end of this task.

- [ ] **Step 1: Create `supabase/functions/predict-expiry/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { name?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const name = body.name.trim();
    const prompt = `How long does "${name}" keep in a typical home refrigerator? Return ONLY valid JSON with no markdown: {"days": <integer>, "explanation": "<one sentence, e.g. Raw chicken keeps 1-2 days in the fridge.>"}`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({ error: `AI API error: ${aiResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let aiData: { content?: { text: string }[] };
    try {
      aiData = await aiResponse.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = aiData.content?.[0]?.text ?? '';
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not extract prediction from AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prediction: { days: number; explanation: string } = JSON.parse(jsonMatch[0]);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Math.max(1, Math.round(prediction.days)));

    return new Response(JSON.stringify({
      expiryDate: expiryDate.toISOString().split('T')[0],
      explanation: prediction.explanation,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Internal server error: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Deploy the edge function**

```bash
npx supabase functions deploy predict-expiry
```

Expected: `Deployed predict-expiry`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/predict-expiry/index.ts
git commit -m "feat: add predict-expiry edge function"
```

---

## Task 3: useExpiryPrediction hook

**Files:**
- Create: `src/features/fridge/useExpiryPrediction.ts`
- Test: `src/__tests__/features/fridge/useExpiryPrediction.test.ts`

The test covers `fetchExpiryPrediction` — the exported async helper. The hook's React lifecycle is not unit-tested (too much mock overhead for timers/hooks), but `fetchExpiryPrediction` is its only external call and fully testable.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/features/fridge/useExpiryPrediction.test.ts`:

```typescript
/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { fetchExpiryPrediction } from '../../../features/fridge/useExpiryPrediction';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = (supabase.functions as { invoke: jest.Mock }).invoke;

describe('fetchExpiryPrediction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns expiryDate and explanation on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { expiryDate: '2026-05-07', explanation: 'Salmon keeps 1–2 days.' },
      error: null,
    });

    const result = await fetchExpiryPrediction('wild salmon');
    expect(result.expiryDate).toBe('2026-05-07');
    expect(result.explanation).toBe('Salmon keeps 1–2 days.');
    expect(mockInvoke).toHaveBeenCalledWith('predict-expiry', { body: { name: 'wild salmon' } });
  });

  it('throws when supabase returns an error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Network error'),
    });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Network error');
  });

  it('throws when response is missing expiryDate', async () => {
    mockInvoke.mockResolvedValue({
      data: { explanation: 'Some text' },
      error: null,
    });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Invalid response from predict-expiry');
  });

  it('throws when response is missing explanation', async () => {
    mockInvoke.mockResolvedValue({
      data: { expiryDate: '2026-05-07' },
      error: null,
    });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Invalid response from predict-expiry');
  });

  it('throws when data is null and error is null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(fetchExpiryPrediction('something')).rejects.toThrow('Invalid response from predict-expiry');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx jest src/__tests__/features/fridge/useExpiryPrediction.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create `src/features/fridge/useExpiryPrediction.ts`**

```typescript
import { useState, useEffect, useRef } from 'react';
import { lookupExpiry, daysFromNow } from '@/src/lib/expiryLookup';
import { supabase } from '@/src/lib/supabase/client';

export interface ExpiryPrediction {
  expiryDate: string | null;
  explanation: string | null;
  isLoading: boolean;
  source: 'lookup' | 'ai' | null;
}

export async function fetchExpiryPrediction(
  name: string
): Promise<{ expiryDate: string; explanation: string }> {
  const { data, error } = await supabase.functions.invoke('predict-expiry', {
    body: { name },
  });
  if (error) throw error;
  if (!data?.expiryDate || !data?.explanation) {
    throw new Error('Invalid response from predict-expiry');
  }
  return { expiryDate: data.expiryDate as string, explanation: data.explanation as string };
}

export function useExpiryPrediction(name: string): ExpiryPrediction {
  const [state, setState] = useState<ExpiryPrediction>({
    expiryDate: null,
    explanation: null,
    isLoading: false,
    source: null,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = name.trim();
    if (!trimmed) {
      setState({ expiryDate: null, explanation: null, isLoading: false, source: null });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const lookup = lookupExpiry(trimmed);
      if (lookup) {
        setState({
          expiryDate: daysFromNow(lookup.days),
          explanation: lookup.explanation,
          isLoading: false,
          source: 'lookup',
        });
        return;
      }

      setState({ expiryDate: null, explanation: null, isLoading: true, source: null });
      try {
        const result = await fetchExpiryPrediction(trimmed);
        setState({
          expiryDate: result.expiryDate,
          explanation: result.explanation,
          isLoading: false,
          source: 'ai',
        });
      } catch {
        setState({ expiryDate: null, explanation: null, isLoading: false, source: null });
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  return state;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
npx jest src/__tests__/features/fridge/useExpiryPrediction.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/fridge/useExpiryPrediction.ts src/__tests__/features/fridge/useExpiryPrediction.test.ts
git commit -m "feat: add useExpiryPrediction hook with hybrid lookup/AI"
```

---

## Task 4: Update AddFridgeItemModal

**Files:**
- Modify: `src/features/fridge/AddFridgeItemModal.tsx` (full replacement)

No new test file — component rendering tests are out of scope. The integration is verified manually in Expo Go.

- [ ] **Step 1: Replace `src/features/fridge/AddFridgeItemModal.tsx`**

Replace the entire file with:

```typescript
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';
import { useExpiryPrediction } from './useExpiryPrediction';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: string, expiryDate: string | null) => Promise<void>;
}

export function AddFridgeItemModal({ visible, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [manualExpiry, setManualExpiry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const prediction = useExpiryPrediction(name);

  useEffect(() => {
    if (!name.trim()) setManualExpiry(null);
  }, [name]);

  const effectiveExpiry = manualExpiry ?? prediction.expiryDate ?? '';
  const isAiFilled = manualExpiry === null && prediction.source !== null;
  const isPredicting = manualExpiry === null && prediction.isLoading;

  function reset() {
    setName('');
    setQuantity('1');
    setManualExpiry(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAdd() {
    if (!name.trim()) { setError('Item name is required'); return; }
    if (!quantity.trim()) { setError('Quantity is required'); return; }

    const dateToSubmit = effectiveExpiry.trim() || null;
    if (dateToSubmit && !/^\d{4}-\d{2}-\d{2}$/.test(dateToSubmit)) {
      setError('Date must be in YYYY-MM-DD format');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await onAdd(name.trim(), quantity.trim(), dateToSubmit);
      reset();
      onClose();
    } catch {
      setError('Failed to add item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: COLORS.surface }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>Add to Fridge</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>ITEM NAME *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Whole milk"
            placeholderTextColor="#9ca3af"
            autoFocus
            style={inputStyle}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>QUANTITY *</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 1, 2 litres, half"
            placeholderTextColor="#9ca3af"
            style={inputStyle}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>EXPIRY DATE</Text>

          {isPredicting ? (
            <View style={{
              backgroundColor: COLORS.bg,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderStyle: 'dashed',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: COLORS.muted }}>Looking up expiry…</Text>
            </View>
          ) : isAiFilled ? (
            <>
              <TouchableOpacity
                onPress={() => setManualExpiry(prediction.expiryDate ?? '')}
                style={{
                  backgroundColor: COLORS.bg,
                  borderWidth: 1.5,
                  borderColor: COLORS.primary,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 16, color: COLORS.text }}>{prediction.expiryDate}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    backgroundColor: '#fff0e6',
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600' }}>✦ AI</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: COLORS.muted }}>✎</Text>
                </View>
              </TouchableOpacity>
              {prediction.explanation ? (
                <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
                  {prediction.explanation}
                </Text>
              ) : null}
            </>
          ) : (
            <TextInput
              value={manualExpiry ?? ''}
              onChangeText={setManualExpiry}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
              style={inputStyle}
            />
          )}

          {error ? (
            <Text style={{ color: COLORS.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleAdd}
            disabled={isLoading || !name.trim()}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: isLoading || !name.trim() ? 0.5 : 1,
              marginTop: 8,
            }}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Add Item</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```
npx jest --no-coverage
```

Expected: All existing tests PASS. Zero TypeScript errors.

- [ ] **Step 3: TypeScript check**

```
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Manual verification in Expo Go**

Start app:
```
npm start
```

Test these scenarios:
1. Open fridge tab → tap + → type "milk" → pause 500ms → expiry field fills with a date ~7 days out, orange border, "✦ AI" badge, explanation "Milk keeps about a week in the fridge."
2. Tap the AI-filled date → field switches to a text input, pre-filled with the predicted date
3. Type "leftover biryani" → pause 500ms → spinner appears → AI-predicted date fills in after ~1–2s
4. Clear name → expiry field clears
5. Leave expiry blank → tap Add Item → item saves with no expiry date
6. Add item with AI-predicted expiry → item appears in fridge with the correct expiry date

- [ ] **Step 5: Commit**

```bash
git add src/features/fridge/AddFridgeItemModal.tsx
git commit -m "feat: AI expiry auto-fill in Add to Fridge modal"
```

- [ ] **Step 6: Push**

```bash
git push
```
