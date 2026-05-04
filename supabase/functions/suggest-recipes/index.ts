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

    const { data: items, error: itemsError } = await supabase
      .from('fridge_items')
      .select('name, quantity')
      .eq('household_id', profile.household_id);

    if (itemsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch fridge items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Your fridge is empty — add some items first!' }), {
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

    const itemList = items
      .map((i: { name: string; quantity: string }) => `${i.name} (${i.quantity})`)
      .join(', ');

    const { data: householdData } = await supabase
      .from('households')
      .select('dietary_restrictions')
      .eq('id', profile.household_id)
      .single();

    const restrictions: string[] = householdData?.dietary_restrictions ?? [];
    const dietaryLine = restrictions.length > 0
      ? `\n\nDietary restrictions for this household: ${restrictions.join(', ')}. Respect these in all suggestions.`
      : '';

    const prompt = `I have these items in my fridge: ${itemList}.${dietaryLine}

Suggest exactly 3 simple recipes I can make using some or all of these ingredients. Return ONLY a valid JSON array with no markdown, no explanation. Each object must have:
- "title": string (recipe name)
- "ingredients": array of strings (what's needed)
- "instructions": string (numbered steps separated by \\n)

Example format: [{"title":"...","ingredients":["..."],"instructions":"1. ...\\n2. ..."}]`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const responseText = await aiResponse.text();

    if (!aiResponse.ok) {
      return new Response(JSON.stringify({ error: `AI API error: ${aiResponse.status} — ${responseText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let aiData: { content?: { text: string }[] };
    try {
      aiData = JSON.parse(responseText);
    } catch {
      return new Response(JSON.stringify({ error: `Failed to parse AI response: ${responseText.slice(0, 200)}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content: string = aiData.content?.[0]?.text ?? '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: `Could not extract recipes from: ${content.slice(0, 200)}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipes = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ recipes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Internal server error: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
