import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Best-effort parse of free-text quantity like "2 lbs" or "1" into { quantity, unit }.
// Falls back to 1 / "each" when it can't confidently parse a leading number.
function parseQuantity(raw: string | null): { quantity: number; unit: string } {
  if (!raw) return { quantity: 1, unit: 'each' };
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { quantity: 1, unit: 'each' };
  const quantity = parseFloat(match[1]);
  const unit = match[2].trim() || 'each';
  return { quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, unit };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'No authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.household_id) {
      return jsonResponse({ error: 'No household found' }, 400);
    }

    const householdId = profile.household_id as string;

    const { data: items, error: itemsError } = await supabase
      .from('shopping_list_items')
      .select('name, quantity')
      .eq('household_id', householdId)
      .eq('is_bought', false);

    if (itemsError) {
      return jsonResponse({ error: 'Failed to load shopping list' }, 500);
    }

    const shoppingItems = (items ?? []) as { name: string; quantity: string | null }[];
    if (shoppingItems.length === 0) {
      return jsonResponse({ error: 'empty_list' }, 400);
    }

    const instacartApiKey = Deno.env.get('INSTACART_API_KEY');
    if (!instacartApiKey) {
      return jsonResponse({ error: 'not_configured' }, 501);
    }

    const baseUrl = Deno.env.get('INSTACART_BASE_URL') ?? 'https://connect.dev.instacart.tools';

    const lineItems = shoppingItems.map((item) => {
      const { quantity, unit } = parseQuantity(item.quantity);
      return { name: item.name, quantity, unit };
    });

    const instacartResponse = await fetch(`${baseUrl}/idp/v1/products/products_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instacartApiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title: 'Leftovers Shopping List',
        link_type: 'shopping_list',
        expires_in: 7,
        line_items: lineItems,
      }),
    });

    const responseText = await instacartResponse.text();

    if (!instacartResponse.ok) {
      return jsonResponse({ error: 'instacart_error' }, 502);
    }

    let instacartData: { products_link_url?: string };
    try {
      instacartData = JSON.parse(responseText);
    } catch {
      return jsonResponse({ error: 'instacart_error' }, 502);
    }

    if (!instacartData.products_link_url) {
      return jsonResponse({ error: 'instacart_error' }, 502);
    }

    return jsonResponse({ url: instacartData.products_link_url });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${String(err)}` }, 500);
  }
});
