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
      ? fridgeItems.map((i) => `- ${i.name}${i.expiry_date ? ` (expires ${i.expiry_date})` : ''}`).join('\n')
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

    // Read body as text FIRST (preserves error message if not ok)
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

    const content = aiData.content?.[0]?.text ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not extract suggestions from AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(jsonMatch[0]) as { suggestions?: { name: string; reason: string }[] };
    if (!Array.isArray(result.suggestions)) {
      return new Response(JSON.stringify({ error: 'Unexpected AI response shape' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingNames = new Set([
      ...shoppingItems.map((i) => i.name.toLowerCase()),
      ...staples.map((s) => s.name.toLowerCase()),
    ]);

    const filtered = result.suggestions.filter(
      (s) => !existingNames.has(s.name.toLowerCase())
    );

    return new Response(JSON.stringify({ suggestions: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Internal server error: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
