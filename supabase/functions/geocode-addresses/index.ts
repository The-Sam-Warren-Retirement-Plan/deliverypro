import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_ids } = await req.json();
    if (!order_ids?.length) {
      return new Response(JSON.stringify({ error: "No order_ids provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("VITE_GOOGLE_MAPS_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: orders } = await supabase
      .from("orders")
      .select("pkgplace_id, address, address_line2, zip_code, latitude, longitude")
      .in("pkgplace_id", order_ids)
      .is("latitude", null);

    if (!orders?.length) {
      return new Response(JSON.stringify({ geocoded: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let geocoded = 0;
    for (const order of orders) {
      const fullAddress = [order.address, order.address_line2, order.zip_code].filter(Boolean).join(", ");
      if (!fullAddress) continue;

      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${googleApiKey}`
        );
        const data = await res.json();
        if (data.results?.[0]) {
          const { lat, lng } = data.results[0].geometry.location;
          const formatted = data.results[0].formatted_address;
          await supabase.from("orders").update({
            latitude: lat,
            longitude: lng,
            formatted_address: formatted,
          }).eq("pkgplace_id", order.pkgplace_id);
          geocoded++;
        }
      } catch (e) {
        console.error(`Geocode failed for ${order.pkgplace_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ geocoded }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
