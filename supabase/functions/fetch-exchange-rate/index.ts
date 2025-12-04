import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching USD to MXN exchange rate from Frankfurter API...');
    
    // Fetch exchange rate from Frankfurter API (free, no API key needed)
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN');
    
    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rate = data.rates?.MXN;
    
    if (!rate) {
      throw new Error('MXN rate not found in response');
    }
    
    console.log(`Fetched rate: 1 USD = ${rate} MXN`);
    
    // Initialize Supabase client with service role key for insert
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Insert the new rate
    const { data: insertedRate, error } = await supabase
      .from('exchange_rates')
      .insert({
        base_currency: 'USD',
        target_currency: 'MXN',
        rate: rate,
        fetched_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }
    
    console.log('Exchange rate saved successfully:', insertedRate);
    
    // Clean up old rates (keep only last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { error: deleteError } = await supabase
      .from('exchange_rates')
      .delete()
      .lt('fetched_at', thirtyDaysAgo.toISOString());
    
    if (deleteError) {
      console.warn('Failed to cleanup old rates:', deleteError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        rate: rate,
        fetched_at: insertedRate.fetched_at 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
