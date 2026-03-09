import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WAREHOUSE_LAT = 43.6629;
const WAREHOUSE_LNG = -79.6197;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { route_id } = await req.json();
    if (!route_id) {
      return new Response(JSON.stringify({ error: "No route_id provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("VITE_GOOGLE_MAPS_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get route orders with their order details
    const { data: routeOrders } = await supabase
      .from("route_orders")
      .select("id, order_id, stop_order")
      .eq("route_id", route_id)
      .order("stop_order");

    if (!routeOrders?.length) {
      return new Response(JSON.stringify({ error: "No stops found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orderIds = routeOrders.map((ro) => ro.order_id);
    const { data: orders } = await supabase
      .from("orders")
      .select("pkgplace_id, latitude, longitude")
      .in("pkgplace_id", orderIds);

    const orderMap = new Map((orders || []).map((o) => [o.pkgplace_id, o]));

    // Filter stops with coordinates
    const stopsWithCoords = routeOrders.filter((ro) => {
      const o = orderMap.get(ro.order_id);
      return o?.latitude && o?.longitude;
    });

    if (stopsWithCoords.length < 2) {
      return new Response(JSON.stringify({ message: "Not enough geocoded stops to optimize" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build waypoints for Google Routes API v2
    const intermediates = stopsWithCoords.map((ro) => {
      const o = orderMap.get(ro.order_id)!;
      return {
        location: {
          latLng: { latitude: o.latitude, longitude: o.longitude },
        },
      };
    });

    const routeRequest = {
      origin: {
        location: { latLng: { latitude: WAREHOUSE_LAT, longitude: WAREHOUSE_LNG } },
      },
      destination: {
        location: { latLng: { latitude: WAREHOUSE_LAT, longitude: WAREHOUSE_LNG } },
      },
      intermediates,
      travelMode: "DRIVE",
      optimizeWaypointOrder: true,
    };

    const routeRes = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex",
        },
        body: JSON.stringify(routeRequest),
      }
    );

    const routeData = await routeRes.json();

    if (!routeData.routes?.[0]?.optimizedIntermediateWaypointIndex) {
      return new Response(JSON.stringify({ error: "Could not optimize route", detail: routeData }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const optimizedOrder = routeData.routes[0].optimizedIntermediateWaypointIndex;

    // Update stop_order in database
    for (let i = 0; i < optimizedOrder.length; i++) {
      const originalIdx = optimizedOrder[i];
      const ro = stopsWithCoords[originalIdx];
      await supabase.from("route_orders").update({ stop_order: i }).eq("id", ro.id);
    }

    // Handle stops without coordinates — append at end
    const stopsWithoutCoords = routeOrders.filter((ro) => {
      const o = orderMap.get(ro.order_id);
      return !o?.latitude || !o?.longitude;
    });
    for (let i = 0; i < stopsWithoutCoords.length; i++) {
      await supabase.from("route_orders").update({ stop_order: optimizedOrder.length + i }).eq("id", stopsWithoutCoords[i].id);
    }

    return new Response(JSON.stringify({ optimized: optimizedOrder.length, total: routeOrders.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
