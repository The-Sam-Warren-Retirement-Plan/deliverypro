import { useState, useEffect, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const WAREHOUSE_LAT = 43.6629;
const WAREHOUSE_LNG = -79.6197;
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface Props {
  orders: Tables<"orders">[];
}

interface Driver {
  id: string;
  display_name: string | null;
}

export default function AdminMapView({ orders }: Props) {
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverOrderIds, setDriverOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchDrivers = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
      if (!roles?.length) return;
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", roles.map((r) => r.user_id));
      setDrivers(profiles || []);
    };
    fetchDrivers();
  }, []);

  useEffect(() => {
    if (driverFilter === "all") { setDriverOrderIds(new Set()); return; }
    const fetchDriverOrders = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: routes } = await supabase.from("routes").select("id").eq("driver_id", driverFilter);
      if (!routes?.length) { setDriverOrderIds(new Set()); return; }
      const { data: ro } = await supabase.from("route_orders").select("order_id").in("route_id", routes.map((r) => r.id));
      setDriverOrderIds(new Set((ro || []).map((r) => r.order_id)));
    };
    fetchDriverOrders();
  }, [driverFilter]);

  const visibleOrders = useMemo(() => {
    const withCoords = orders.filter((o) => o.latitude && o.longitude);
    if (driverFilter === "all") return withCoords;
    return withCoords.filter((o) => driverOrderIds.has(o.pkgplace_id));
  }, [orders, driverFilter, driverOrderIds]);

  const getMarkerColor = (order: Tables<"orders">) => {
    const isPickup = order.delivery_status === "requested" || order.delivery_status === "ready";
    if (isPickup) return { background: "hsl(205, 80%, 50%)", glyphColor: "#fff", borderColor: "hsl(205, 80%, 40%)" }; // blue
    if (order.payment_status === "unpaid") return { background: "hsl(0, 72%, 50%)", glyphColor: "#fff", borderColor: "hsl(0, 72%, 40%)" }; // red
    return { background: "hsl(152, 60%, 40%)", glyphColor: "#fff", borderColor: "hsl(152, 60%, 30%)" }; // green
  };

  if (!API_KEY) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Google Maps API key not configured</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by driver" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-info inline-block" /> Pickups</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-success inline-block" /> Paid</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-destructive inline-block" /> Unpaid</span>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ height: "600px" }}>
        <APIProvider apiKey={API_KEY}>
          <Map
            defaultCenter={{ lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG }}
            defaultZoom={11}
            mapId="admin-map"
            style={{ width: "100%", height: "100%" }}
          >
            {/* Warehouse marker */}
            <AdvancedMarker position={{ lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG }}>
              <Pin background="hsl(38, 92%, 50%)" glyphColor="#fff" borderColor="hsl(38, 92%, 40%)" scale={1.2} />
            </AdvancedMarker>

            {visibleOrders.map((order) => {
              const colors = getMarkerColor(order);
              return (
                <AdvancedMarker key={order.pkgplace_id} position={{ lat: order.latitude!, lng: order.longitude! }}>
                  <Pin background={colors.background} glyphColor={colors.glyphColor} borderColor={colors.borderColor} />
                </AdvancedMarker>
              );
            })}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
