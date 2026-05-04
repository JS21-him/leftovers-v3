# Photo & Receipt Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fridge `+` FAB with a SpeedDial that lets users add items by scanning a grocery receipt or photographing items — no review screen, instant add, swipe-to-delete handles corrections.

**Architecture:** `expo-image-picker` captures images → base64-encoded and sent to one of two Supabase Edge Functions → each function calls Claude Vision → extracts items → applies category-based expiry defaults → inserts to `fridge_items` → returns inserted rows → client invalidates TanStack Query cache and refreshes the fridge list.

**Tech Stack:** expo-image-picker, expo SDK 54, Supabase Edge Functions (Deno), Claude Haiku Vision API (claude-haiku-4-5-20251001), TanStack Query v5, Zustand auth store, React Native Alert (no toast library installed).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/expiryDefaults.ts` | Create | `getExpiryDate(category): string` — category → YYYY-MM-DD |
| `src/__tests__/lib/expiryDefaults.test.ts` | Create | Tests for all 7 categories + unknown fallback |
| `src/features/fridge/useScanFridge.ts` | Create | `scanReceipt`, `scanItems` async fns + TanStack mutations |
| `src/__tests__/features/fridge/useScanFridge.test.ts` | Create | Tests for both scan functions (success, empty, error) |
| `supabase/functions/scan-receipt/index.ts` | Create | Edge Function — receipt vision → insert fridge items |
| `supabase/functions/scan-items/index.ts` | Create | Edge Function — item photo vision → insert fridge items |
| `src/features/fridge/SpeedDialFAB.tsx` | Create | Expandable FAB with 3 dial options |
| `app/(tabs)/fridge.tsx` | Modify | Replace FAB with SpeedDialFAB + scan handlers + loading overlay |

---

## Task 1: Install expo-image-picker

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the package**

```bash
npm install expo-image-picker --legacy-peer-deps
```

Expected output: `added X packages` (no errors).

- [ ] **Step 2: Verify it appears in package.json**

Check `package.json` dependencies — `expo-image-picker` should be listed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install expo-image-picker for receipt/item scanning"
```

---

## Task 2: Create expiryDefaults.ts (TDD)

**Files:**
- Create: `src/__tests__/lib/expiryDefaults.test.ts`
- Create: `src/lib/expiryDefaults.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/expiryDefaults.test.ts`:

```typescript
/**
 * @jest-environment node
 */
/// <reference types="jest" />

import { getExpiryDate } from '../../lib/expiryDefaults';

describe('getExpiryDate', () => {
  function expectedDate(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
  }

  it('produce → +5 days', () => {
    expect(getExpiryDate('produce')).toBe(expectedDate(5));
  });

  it('dairy → +7 days', () => {
    expect(getExpiryDate('dairy')).toBe(expectedDate(7));
  });

  it('meat → +3 days', () => {
    expect(getExpiryDate('meat')).toBe(expectedDate(3));
  });

  it('frozen → +90 days', () => {
    expect(getExpiryDate('frozen')).toBe(expectedDate(90));
  });

  it('beverages → +14 days', () => {
    expect(getExpiryDate('beverages')).toBe(expectedDate(14));
  });

  it('pantry → +180 days', () => {
    expect(getExpiryDate('pantry')).toBe(expectedDate(180));
  });

  it('other → +7 days', () => {
    expect(getExpiryDate('other')).toBe(expectedDate(7));
  });

  it('unknown category falls back to +7 days', () => {
    expect(getExpiryDate('mystery')).toBe(expectedDate(7));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/lib/expiryDefaults.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../lib/expiryDefaults'`

- [ ] **Step 3: Implement expiryDefaults.ts**

Create `src/lib/expiryDefaults.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/lib/expiryDefaults.test.ts --no-coverage
```

Expected: PASS — 8/8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/expiryDefaults.ts src/__tests__/lib/expiryDefaults.test.ts
git commit -m "feat: add category-based expiry defaults with tests"
```

---

## Task 3: Create useScanFridge.ts (TDD)

**Files:**
- Create: `src/__tests__/features/fridge/useScanFridge.test.ts`
- Create: `src/features/fridge/useScanFridge.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/features/fridge/useScanFridge.test.ts`:

```typescript
/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));
jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { scanReceipt, scanItems } from '../../../features/fridge/useScanFridge';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = supabase.functions.invoke as jest.Mock;

const mockItem = {
  id: '1',
  household_id: 'hh-1',
  added_by: 'u-1',
  name: 'Milk',
  quantity: '1',
  expiry_date: '2026-05-10',
  barcode: null,
  category: 'dairy',
  created_at: '',
};

describe('scanReceipt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items on valid response', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [mockItem] }, error: null });
    const result = await scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Milk');
    expect(mockInvoke).toHaveBeenCalledWith('scan-receipt', {
      body: { image: 'base64data', householdId: 'hh-1', userId: 'u-1' },
    });
  });

  it('returns [] when items array is empty', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });
    const result = await scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(
      scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' })
    ).rejects.toThrow('Network error');
  });

  it('throws when data contains error field', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'AI service not configured' }, error: null });
    await expect(
      scanReceipt({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' })
    ).rejects.toThrow('AI service not configured');
  });
});

describe('scanItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items on valid response', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [mockItem] }, error: null });
    const result = await scanItems({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Milk');
    expect(mockInvoke).toHaveBeenCalledWith('scan-items', {
      body: { image: 'base64data', householdId: 'hh-1', userId: 'u-1' },
    });
  });

  it('returns [] when items array is empty', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });
    const result = await scanItems({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' });
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(
      scanItems({ image: 'base64data', householdId: 'hh-1', userId: 'u-1' })
    ).rejects.toThrow('Network error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/features/fridge/useScanFridge.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../features/fridge/useScanFridge'`

- [ ] **Step 3: Implement useScanFridge.ts**

Create `src/features/fridge/useScanFridge.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { useAuthStore } from '@/src/store/auth';
import { logger } from '@/src/lib/logger';
import type { FridgeItem } from '@/src/types/database';

interface ScanParams {
  image: string;
  householdId: string;
  userId: string;
}

export async function scanReceipt(params: ScanParams): Promise<FridgeItem[]> {
  const { data, error } = await supabase.functions.invoke('scan-receipt', { body: params });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.items ?? [];
}

export async function scanItems(params: ScanParams): Promise<FridgeItem[]> {
  const { data, error } = await supabase.functions.invoke('scan-items', { body: params });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.items ?? [];
}

export function useScanReceipt(householdId: string | null) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (image: string) => {
      if (!householdId || !user) throw new Error('Not authenticated');
      return scanReceipt({ image, householdId, userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
    },
    onError: (err) => logger.error('scanReceipt failed', err),
  });
}

export function useScanItems(householdId: string | null) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (image: string) => {
      if (!householdId || !user) throw new Error('Not authenticated');
      return scanItems({ image, householdId, userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', householdId] });
    },
    onError: (err) => logger.error('scanItems failed', err),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/features/fridge/useScanFridge.test.ts --no-coverage
```

Expected: PASS — 7/7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/features/fridge/useScanFridge.ts "src/__tests__/features/fridge/useScanFridge.test.ts"
git commit -m "feat: add scanReceipt and scanItems with TanStack mutations and tests"
```

---

## Task 4: Create scan-receipt Edge Function

**Files:**
- Create: `supabase/functions/scan-receipt/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/scan-receipt/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPIRY_DAYS: Record<string, number> = {
  produce: 5, dairy: 7, meat: 3, frozen: 90, beverages: 14, pantry: 180, other: 7,
};

function getExpiryDate(category: string): string {
  const days = EXPIRY_DAYS[category] ?? EXPIRY_DAYS.other;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

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

    const { image, householdId } = await req.json() as { image: string; householdId: string; userId: string };

    if (!image || !householdId) {
      return new Response(JSON.stringify({ error: 'Missing image or householdId' }), {
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

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image,
                },
              },
              {
                type: 'text',
                text: 'This is a grocery receipt. Extract every food/grocery item. Return ONLY a JSON array: [{name, quantity, category}]. category must be one of: dairy, produce, meat, pantry, frozen, beverages, other. Use quantity from the receipt (e.g. "2", "1 lb"). If unclear, default quantity to "1".',
              },
            ],
          },
        ],
      }),
    });

    const responseText = await aiResponse.text();

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({ error: `AI API error: ${aiResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let aiData: { content?: { text: string }[] };
    try {
      aiData = JSON.parse(responseText);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content: string = aiData.content?.[0]?.text ?? '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: { name: string; quantity: string; category: string }[] = [];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = parsed
      .filter((p) => p?.name)
      .map((p) => ({
        household_id: householdId,
        added_by: user.id,
        name: String(p.name).trim(),
        quantity: String(p.quantity ?? '1').trim(),
        category: p.category ?? 'other',
        expiry_date: getExpiryDate(p.category ?? 'other'),
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('fridge_items')
      .insert(rows)
      .select();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ items: inserted ?? [] }), {
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

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/scan-receipt/index.ts
git commit -m "feat: add scan-receipt edge function for receipt vision"
```

---

## Task 5: Create scan-items Edge Function

**Files:**
- Create: `supabase/functions/scan-items/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/scan-items/index.ts`. Identical to `scan-receipt/index.ts` except for the prompt:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPIRY_DAYS: Record<string, number> = {
  produce: 5, dairy: 7, meat: 3, frozen: 90, beverages: 14, pantry: 180, other: 7,
};

function getExpiryDate(category: string): string {
  const days = EXPIRY_DAYS[category] ?? EXPIRY_DAYS.other;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

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

    const { image, householdId } = await req.json() as { image: string; householdId: string; userId: string };

    if (!image || !householdId) {
      return new Response(JSON.stringify({ error: 'Missing image or householdId' }), {
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

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image,
                },
              },
              {
                type: 'text',
                text: 'This is a photo of food items or groceries. Identify every visible food item. Return ONLY a JSON array: [{name, quantity, category}]. category must be one of: dairy, produce, meat, pantry, frozen, beverages, other. Default quantity to "1".',
              },
            ],
          },
        ],
      }),
    });

    const responseText = await aiResponse.text();

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({ error: `AI API error: ${aiResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let aiData: { content?: { text: string }[] };
    try {
      aiData = JSON.parse(responseText);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content: string = aiData.content?.[0]?.text ?? '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: { name: string; quantity: string; category: string }[] = [];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = parsed
      .filter((p) => p?.name)
      .map((p) => ({
        household_id: householdId,
        added_by: user.id,
        name: String(p.name).trim(),
        quantity: String(p.quantity ?? '1').trim(),
        category: p.category ?? 'other',
        expiry_date: getExpiryDate(p.category ?? 'other'),
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('fridge_items')
      .insert(rows)
      .select();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ items: inserted ?? [] }), {
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

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/scan-items/index.ts
git commit -m "feat: add scan-items edge function for item photo vision"
```

- [ ] **Step 3: Deploy both Edge Functions**

```bash
npx supabase functions deploy scan-receipt
npx supabase functions deploy scan-items
```

Expected: `Deployed Functions scan-receipt` and `Deployed Functions scan-items`. If deploy fails due to network, commit the files and note that deploy must happen from a network-connected shell.

---

## Task 6: Create SpeedDialFAB component

**Files:**
- Create: `src/features/fridge/SpeedDialFAB.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/fridge/SpeedDialFAB.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

interface SpeedDialFABProps {
  onScanReceipt: () => void;
  onPhotoItems: () => void;
  onAddManually: () => void;
}

export function SpeedDialFAB({ onScanReceipt, onPhotoItems, onAddManually }: SpeedDialFABProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  function handleOption(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <>
      {open ? (
        <Pressable
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onPress={() => setOpen(false)}
        />
      ) : null}

      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          right: 24,
          alignItems: 'flex-end',
        }}
      >
        {open ? (
          <>
            <DialOption label="Scan Receipt" emoji="🧾" onPress={() => handleOption(onScanReceipt)} />
            <DialOption label="Photo of Items" emoji="📷" onPress={() => handleOption(onPhotoItems)} />
            <DialOption label="Add Manually" emoji="✏️" onPress={() => handleOption(onAddManually)} />
          </>
        ) : null}

        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: open ? 22 : 28, lineHeight: open ? 26 : 32 }}>
            {open ? '✕' : '+'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function DialOption({
  label, emoji, onPress,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
      }}
    >
      <Text style={{ fontSize: 18, marginRight: 8 }}>{emoji}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>{label}</Text>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/fridge/SpeedDialFAB.tsx
git commit -m "feat: add SpeedDialFAB component with scan receipt, photo, and manual options"
```

---

## Task 7: Update fridge.tsx

**Files:**
- Modify: `app/(tabs)/fridge.tsx`

- [ ] **Step 1: Replace the fridge screen**

Replace the entire content of `app/(tabs)/fridge.tsx` with:

```typescript
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/src/store/auth';
import { useHousehold } from '@/src/features/fridge/useHousehold';
import { useFridgeItems, useDeleteFridgeItem } from '@/src/features/fridge/useFridgeItems';
import { useScanReceipt, useScanItems } from '@/src/features/fridge/useScanFridge';
import { FridgeItemCard } from '@/src/features/fridge/FridgeItemCard';
import { AddFridgeItemModal } from '@/src/features/fridge/AddFridgeItemModal';
import { SpeedDialFAB } from '@/src/features/fridge/SpeedDialFAB';
import { useAddFridgeItem } from '@/src/features/fridge/useFridgeItems';
import { COLORS } from '@/src/lib/constants';
import { logger } from '@/src/lib/logger';
import type { FridgeItem } from '@/src/types/database';

export default function FridgeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!user) return;
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) { setHouseholdError(error); return; }
      setHouseholdId(hid);
    });
  }, [user]);

  const { data: items, isLoading, isError, error, refetch, isRefetching } = useFridgeItems(householdId);
  const addMutation = useAddFridgeItem(householdId);
  const deleteMutation = useDeleteFridgeItem(householdId);
  const scanReceiptMutation = useScanReceipt(householdId);
  const scanItemsMutation = useScanItems(householdId);

  async function handleAdd(name: string, quantity: string, expiryDate: string | null) {
    if (!householdId || !user) return;
    await addMutation.mutateAsync({
      householdId,
      addedBy: user.id,
      name,
      quantity,
      expiryDate,
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onError: (err) => logger.error('delete failed', err),
    });
  }

  function retryHousehold() {
    if (!user) return;
    setHouseholdError(null);
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) setHouseholdError(error);
      else setHouseholdId(hid);
    });
  }

  async function doScan(type: 'receipt' | 'items', source: 'camera' | 'library') {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
        });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const base64 = result.assets[0].base64;
    setScanning(true);
    try {
      const added = type === 'receipt'
        ? await scanReceiptMutation.mutateAsync(base64)
        : await scanItemsMutation.mutateAsync(base64);

      if (added.length === 0) {
        Alert.alert('No items found', 'Try a clearer photo.');
      }
    } catch {
      Alert.alert('Scan failed', 'Something went wrong. Try again.');
    } finally {
      setScanning(false);
    }
  }

  function handleScanSource(type: 'receipt' | 'items') {
    Alert.alert(
      type === 'receipt' ? 'Scan Receipt' : 'Photo of Items',
      'Choose a source',
      [
        { text: 'Take Photo', onPress: () => doScan(type, 'camera') },
        { text: 'Choose from Library', onPress: () => doScan(type, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  const isInitializing = !householdId && !householdError;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.text }}>Fridge</Text>
      </View>

      {(isInitializing || isLoading) && !isRefetching ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : householdError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 16 }}>{householdError}</Text>
          <TouchableOpacity onPress={retryHousehold}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 16 }}>
            {error?.message ?? 'Failed to load fridge items'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<FridgeItem>
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 100,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🧊</Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                Your fridge is empty
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center' }}>
                Tap + to add items — scan a receipt, take a photo, or add manually
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FridgeItemCard item={item} onDelete={handleDelete} />
          )}
        />
      )}

      {scanning ? (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={{ color: COLORS.text, marginTop: 12, fontSize: 15, fontWeight: '600' }}>
              Adding items…
            </Text>
          </View>
        </View>
      ) : null}

      {householdId && !householdError ? (
        <SpeedDialFAB
          onScanReceipt={() => handleScanSource('receipt')}
          onPhotoItems={() => handleScanSource('items')}
          onAddManually={() => setShowAddModal(true)}
        />
      ) : null}

      <AddFridgeItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/fridge.tsx"
git commit -m "feat: replace FAB with SpeedDialFAB; add receipt and photo scanning with loading overlay"
```

---

## Task 8: Run full test suite and push

**Files:** (none changed)

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All tests pass. If any fail, fix before proceeding.

- [ ] **Step 2: Push to GitHub**

```bash
git push
```

Expected: Branch pushed successfully.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ SpeedDial FAB with 3 options (Scan Receipt, Photo of Items, Add Manually)
- ✅ expo-image-picker with Take Photo / Choose from Library via Alert sheet
- ✅ base64 encoding at quality 0.6 (resize not needed without expo-image-manipulator)
- ✅ Loading overlay ("Adding items…") during scan
- ✅ Empty result → "No items found" alert
- ✅ Network error → "Scan failed" alert
- ✅ Category-based expiry defaults applied in both edge functions
- ✅ `scan-receipt` and `scan-items` edge functions using Claude Vision (claude-haiku-4-5-20251001)
- ✅ JWT verification via `supabase.auth.getUser()`
- ✅ Partial JSON parse failure handled (filter + try/catch)
- ✅ `expiryDefaults.ts` with all 7 categories + unknown fallback
- ✅ Tests: expiryDefaults (8 cases), useScanFridge (7 cases)

**Type consistency:**
- `ScanParams`: `{ image: string; householdId: string; userId: string }` — used consistently in `scanReceipt`, `scanItems`, and tests
- `SpeedDialFABProps`: `onScanReceipt`, `onPhotoItems`, `onAddManually` — matches fridge.tsx usage
- Edge function returns `{ items: FridgeItem[] }` — matches client `data?.items ?? []` extraction
