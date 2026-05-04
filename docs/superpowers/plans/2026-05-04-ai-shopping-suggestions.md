# AI Shopping Suggestions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline "✦ N items to consider" banner at the top of the Shopping tab that shows AI-generated grocery suggestions based on fridge contents, expiring items, and shopping habits — each with a one-tap "+ Add" button that sends it to THIS WEEK.

**Architecture:** A `suggest-shopping` Supabase edge function reads fridge, shopping list, and staples, then calls Claude Haiku to produce 3–5 suggestions. `useShoppingSuggestions` manages session-scoped state (generates once per mount, never auto-retries) using a `useRef` guard. `ShoppingSuggestionsCard` renders the banner. `shopping.tsx` wires the hook and component into the existing `renderWeeklyHeader`.

**Tech Stack:** React Native, Expo SDK 54, TypeScript strict, Supabase Edge Functions (Deno), Claude Haiku (`claude-haiku-4-5-20251001`), Jest / jest-expo

**Prerequisite:** AI Expiry Prediction plan (`2026-05-04-ai-expiry-prediction.md`) must be complete first (both plans share the same branch — the edge function deployment pattern is identical).

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/functions/suggest-shopping/index.ts` |
| Create | `src/features/shopping/useShoppingSuggestions.ts` |
| Create | `src/__tests__/features/shopping/useShoppingSuggestions.test.ts` |
| Create | `src/features/shopping/ShoppingSuggestionsCard.tsx` |
| Modify | `app/(tabs)/shopping.tsx` |

---

## Task 1: suggest-shopping edge function

**Files:**
- Create: `supabase/functions/suggest-shopping/index.ts`

No unit tests — manual integration test at end of task.

- [ ] **Step 1: Create `supabase/functions/suggest-shopping/index.ts`**

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.household_id) {
      return new Response(JSON.stringify({ error: 'No household found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const householdId = profile.household_id as string;

    const [fridgeResult, shoppingResult, staplesResult] = await Promise.all([
      supabase
        .from('fridge_items')
        .select('name, expiry_date')
        .eq('household_id', householdId),
      supabase
        .from('shopping_list_items')
        .select('name')
        .eq('household_id', householdId)
        .eq('is_bought', false),
      supabase
        .from('staples')
        .select('name')
        .eq('household_id', householdId),
    ]);

    const fridgeItems = (fridgeResult.data ?? []) as { name: string; expiry_date: string | null }[];
    const shoppingItems = (shoppingResult.data ?? []) as { name: string }[];
    const staples = (staplesResult.data ?? []) as { name: string }[];

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];

    const fridgeLines = fridgeItems.length > 0
      ? fridgeItems
          .map((i) => `- ${i.name}${i.expiry_date ? ` (expires ${i.expiry_date})` : ''}`)
          .join('\n')
      : '(empty)';

    const shoppingLines = shoppingItems.length > 0
      ? shoppingItems.map((i) => `- ${i.name}`).join('\n')
      : '(nothing)';

    const stapleLines = staples.length > 0
      ? staples.map((s) => `- ${s.name}`).join('\n')
      : '(none)';

    const prompt = `Today is ${today}. You are a kitchen assistant helping someone plan their grocery shopping.

Fridge contents:
${fridgeLines}

Already on their shopping list this week:
${shoppingLines}

Weekly staples they track (already handled, do not suggest):
${stapleLines}

Suggest 3–5 grocery items they should buy. Focus on:
1. Items expiring soon that they will need to replace
2. Common items that seem missing from a well-stocked fridge
3. Balance and variety

Rules:
- Do NOT suggest items already on the shopping list or in weekly staples
- Keep each reason to one short sentence
- Return ONLY valid JSON, no markdown: {"suggestions": [{"name": "item name", "reason": "one sentence why"}]}`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not extract suggestions from AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: { suggestions: { name: string; reason: string }[] } = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ suggestions: result.suggestions ?? [] }), {
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
npx supabase functions deploy suggest-shopping
```

Expected: `Deployed suggest-shopping`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/suggest-shopping/index.ts
git commit -m "feat: add suggest-shopping edge function"
```

---

## Task 2: useShoppingSuggestions hook

**Files:**
- Create: `src/features/shopping/useShoppingSuggestions.ts`
- Test: `src/__tests__/features/shopping/useShoppingSuggestions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/features/shopping/useShoppingSuggestions.test.ts`:

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

import { fetchShoppingSuggestions } from '../../../features/shopping/useShoppingSuggestions';
import { supabase } from '../../../lib/supabase/client';

const mockInvoke = (supabase.functions as { invoke: jest.Mock }).invoke;

describe('fetchShoppingSuggestions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns suggestions array on success', async () => {
    const suggestions = [
      { name: 'Milk', reason: 'Expires tomorrow.' },
      { name: 'Eggs', reason: 'Weekly staple not bought yet.' },
    ];
    mockInvoke.mockResolvedValue({ data: { suggestions }, error: null });

    const result = await fetchShoppingSuggestions();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Milk');
    expect(result[1].reason).toBe('Weekly staple not bought yet.');
    expect(mockInvoke).toHaveBeenCalledWith('suggest-shopping', { body: {} });
  });

  it('returns empty array when suggestions is empty', async () => {
    mockInvoke.mockResolvedValue({ data: { suggestions: [] }, error: null });

    const result = await fetchShoppingSuggestions();
    expect(result).toHaveLength(0);
  });

  it('throws when supabase returns an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network error') });

    await expect(fetchShoppingSuggestions()).rejects.toThrow('Network error');
  });

  it('throws when response has no suggestions array', async () => {
    mockInvoke.mockResolvedValue({ data: { unexpected: 'format' }, error: null });

    await expect(fetchShoppingSuggestions()).rejects.toThrow('Invalid response from suggest-shopping');
  });

  it('throws when data is null and error is null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(fetchShoppingSuggestions()).rejects.toThrow('Invalid response from suggest-shopping');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx jest src/__tests__/features/shopping/useShoppingSuggestions.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create `src/features/shopping/useShoppingSuggestions.ts`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase/client';

export interface Suggestion {
  name: string;
  reason: string;
}

export interface ShoppingSuggestionsState {
  suggestions: Suggestion[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export async function fetchShoppingSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await supabase.functions.invoke('suggest-shopping', {
    body: {},
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.suggestions)) {
    throw new Error('Invalid response from suggest-shopping');
  }
  return data.suggestions as Suggestion[];
}

export function useShoppingSuggestions(householdId: string | null): ShoppingSuggestionsState {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasGeneratedRef = useRef(false);

  const generate = useCallback(async () => {
    if (!householdId) return;
    setIsLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await fetchShoppingSuggestions();
      setSuggestions(result);
    } catch {
      setError("Couldn't load suggestions. Tap to retry.");
    } finally {
      setIsLoading(false);
      hasGeneratedRef.current = true;
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId || hasGeneratedRef.current) return;
    generate();
  }, [householdId, generate]);

  const refresh = useCallback(() => {
    hasGeneratedRef.current = false;
    generate();
  }, [generate]);

  return { suggestions, isLoading, error, refresh };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
npx jest src/__tests__/features/shopping/useShoppingSuggestions.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shopping/useShoppingSuggestions.ts src/__tests__/features/shopping/useShoppingSuggestions.test.ts
git commit -m "feat: add useShoppingSuggestions session-scoped hook"
```

---

## Task 3: ShoppingSuggestionsCard component

**Files:**
- Create: `src/features/shopping/ShoppingSuggestionsCard.tsx`

No unit test — pure presentational component, verified manually in Expo Go.

- [ ] **Step 1: Create `src/features/shopping/ShoppingSuggestionsCard.tsx`**

```typescript
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '@/src/lib/constants';
import type { Suggestion } from './useShoppingSuggestions';

interface Props {
  suggestions: Suggestion[] | null;
  isLoading: boolean;
  error: string | null;
  onAdd: (name: string) => void;
  onAddAll: (names: string[]) => void;
  onRefresh: () => void;
}

export function ShoppingSuggestionsCard({
  suggestions,
  isLoading,
  error,
  onAdd,
  onAddAll,
  onRefresh,
}: Props) {
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  if (!isLoading && !error && (!suggestions || suggestions.length === 0)) return null;

  const unaddedSuggestions = (suggestions ?? []).filter((s) => !addedNames.has(s.name));

  function handleAdd(name: string) {
    onAdd(name);
    setAddedNames((prev) => new Set([...prev, name]));
  }

  function handleAddAll() {
    const names = unaddedSuggestions.map((s) => s.name);
    onAddAll(names);
    setAddedNames(new Set((suggestions ?? []).map((s) => s.name)));
  }

  return (
    <View
      style={{
        backgroundColor: '#fff0e6',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>
            {isLoading
              ? '✦ Finding suggestions…'
              : error
                ? '✦ Suggestions unavailable'
                : `✦ ${suggestions!.length} items to consider`}
          </Text>
          {!isLoading && !error && (
            <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
              Based on your fridge & habits
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={{ fontSize: 12, color: COLORS.muted }}>↻ Refresh</Text>
          </TouchableOpacity>
          {!isLoading && !error && unaddedSuggestions.length > 0 && (
            <TouchableOpacity onPress={handleAddAll}>
              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>Add all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={{ fontSize: 14, color: COLORS.muted }}>Finding suggestions…</Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <TouchableOpacity onPress={onRefresh}>
          <Text style={{ fontSize: 13, color: COLORS.muted }}>{error}</Text>
        </TouchableOpacity>
      )}

      {/* Suggestion rows */}
      {suggestions &&
        suggestions.map((suggestion) => {
          const isAdded = addedNames.has(suggestion.name);
          return (
            <View
              key={suggestion.name}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: '#fed7aa',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '600' }}>
                  {suggestion.name}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>{suggestion.reason}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { if (!isAdded) handleAdd(suggestion.name); }}
                disabled={isAdded}
                style={{
                  backgroundColor: isAdded ? COLORS.success : COLORS.primary,
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {isAdded ? '✓ Added' : '+ Add'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
    </View>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/shopping/ShoppingSuggestionsCard.tsx
git commit -m "feat: add ShoppingSuggestionsCard component"
```

---

## Task 4: Wire into shopping.tsx

**Files:**
- Modify: `app/(tabs)/shopping.tsx`

- [ ] **Step 1: Add imports at the top of `app/(tabs)/shopping.tsx`**

After the existing import block, add:

```typescript
import { useShoppingSuggestions } from '@/src/features/shopping/useShoppingSuggestions';
import { ShoppingSuggestionsCard } from '@/src/features/shopping/ShoppingSuggestionsCard';
```

- [ ] **Step 2: Add the `useShoppingSuggestions` hook call**

Inside `ShoppingScreen`, after the existing `deleteStapleMutation` line (line 57), add:

```typescript
const {
  suggestions,
  isLoading: suggestionsLoading,
  error: suggestionsError,
  refresh: refreshSuggestions,
} = useShoppingSuggestions(householdId);
```

- [ ] **Step 3: Add suggestion handler functions**

After `handleDeleteStaple`, add:

```typescript
async function handleAddSuggestion(name: string) {
  if (!householdId || !user) return;
  try {
    await addMutation.mutateAsync({ householdId, addedBy: user.id, name, quantity: '1' });
  } catch {
    Alert.alert('Failed to add item', 'Something went wrong. Try again.');
  }
}

async function handleAddAllSuggestions(names: string[]) {
  if (!householdId || !user) return;
  for (const name of names) {
    try {
      await addMutation.mutateAsync({ householdId, addedBy: user.id, name, quantity: '1' });
    } catch {
      // card tracks optimistic added state — skip individual failures silently
    }
  }
}
```

- [ ] **Step 4: Update `renderWeeklyHeader` to include the card**

Replace the existing `renderWeeklyHeader` with:

```typescript
const renderWeeklyHeader = useCallback(() => (
  <View>
    <ShoppingSuggestionsCard
      suggestions={suggestions}
      isLoading={suggestionsLoading}
      error={suggestionsError}
      onAdd={handleAddSuggestion}
      onAddAll={handleAddAllSuggestions}
      onRefresh={refreshSuggestions}
    />
    {/* WEEKLY section */}
    <Text style={sectionLabel}>WEEKLY</Text>
    <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
      Repeats every week.
    </Text>

    {staples && staples.length > 0 ? (
      staples.map((staple) => (
        <StapleRow
          key={staple.id}
          staple={staple}
          onToggle={() => handleToggleStaple(staple)}
          onDelete={() => handleDeleteStaple(staple.id)}
        />
      ))
    ) : null}

    <TouchableOpacity
      onPress={() => setShowAddStapleModal(true)}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 20, color: COLORS.primary, marginRight: 8, lineHeight: 24 }}>+</Text>
      <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600' }}>Add weekly item</Text>
    </TouchableOpacity>

    {/* Divider */}
    <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 16 }} />

    {/* THIS WEEK header */}
    <Text style={sectionLabel}>THIS WEEK</Text>
  </View>
), [
  staples,
  toggleStapleMutation,
  deleteStapleMutation,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  refreshSuggestions,
]);
```

- [ ] **Step 5: Run full test suite**

```
npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: TypeScript check**

```
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Manual verification in Expo Go**

Start app:
```
npm start
```

Test these scenarios:
1. Open Shopping tab → suggestions banner appears at top with spinner "Finding suggestions…" → after ~2s, 3–5 items appear with names and reasons
2. Tap "+ Add" on a suggestion → button turns "✓ Added" (green) → item appears in THIS WEEK list below
3. Tap "Add all" → all remaining unadded items turn "✓ Added" → all added to THIS WEEK
4. Tap "↻ Refresh" → spinner reappears → new suggestions load
5. Switch to another tab and back → banner does NOT reload (suggestions persist, no spinner)
6. If network is off: "Couldn't load suggestions. Tap to retry." appears → tapping it retries
7. All other Shopping tab functionality (add item, toggle, delete, clear, staples) unchanged

- [ ] **Step 8: Commit**

```bash
git add app/(tabs)/shopping.tsx
git commit -m "feat: AI shopping suggestions banner in Shopping tab"
```

- [ ] **Step 9: Push**

```bash
git push
```
