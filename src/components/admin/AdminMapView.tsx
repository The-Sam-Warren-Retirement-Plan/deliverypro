import { useState, useEffect, useMemo, useCallback } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Layers, X, Send, Zap, MousePointer, Pencil } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

const WAREHOUSE_LAT = 43.6629;
const WAREHOUSE_LNG = -79.6197;
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

type AuctionHouse = Tables<"auction_houses">;

interface Props {
  orders: Tables<"orders">[];
  onOrdersChanged?: () => void;
}

interface Driver { id: string; display_name: string | null; }
interface Vehicle { id: string; year: number | null; make: string; model: string; }

/** Ray-casting point-in-polygon (lat/lng treated as x/y) */
function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((xi > point.lng) !== (xj > point.lng)) &&
      (point.lat < (yj - yi) * (point.lng - xi) / (xj - xi) + yi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onMapClick]);
  return null;
}

export default function AdminMapView({ orders, onOrdersChanged }: Props) {
  const { toast } = useToast();
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverOrderIds, setDriverOrderIds] = useState<Set<string>>(new Set());
  const [auctionHouses, setAuctionHouses] = useState<AuctionHouse[]>([]);

  // Build route mode
  const [buildMode, setBuildMode] = useState<"off" | "click" | "polygon">("off");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [polygonPoints, setPolygonPoints] = useState<{ lat: number; lng: number }[]>([]);

  // Dispatch fields
  const [dispatchDriver, setDispatchDriver] = useState("");
  const [dispatchVehicle, setDispatchVehicle] = useState("");
  const [dispatchDate, setDispatchDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dispatchNote, setDispatchNote] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
      if (roles?.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", roles.map((r) => r.user_id));
        setDrivers(profiles || []);
      }
      const { data: v } = await supabase.from("vehicles").select("id, year, make, model");
      setVehicles(v || []);
      const { data: ah } = await supabase.from("auction_houses").select("*").order("name");
      setAuctionHouses(ah || []);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (driverFilter === "all") { setDriverOrderIds(new Set()); return; }
    const fetchDriverOrders = async () => {
      const { data: routes } = await supabase.from("routes").select("id").eq("driver_id", driverFilter).eq("route_date", dateFilter);
      if (!routes?.length) { setDriverOrderIds(new Set()); return; }
      const { data: ro } = await supabase.from("route_orders").select("order_id").in("route_id", routes.map((r) => r.id));
      setDriverOrderIds(new Set((ro || []).map((r) => r.order_id)));
    };
    fetchDriverOrders();
  }, [driverFilter, dateFilter]);

  // Live view: all non-delivered orders with coords
  const visibleOrders = useMemo(() => {
    const withCoords = orders.filter((o) => o.latitude && o.longitude && o.delivery_status !== "delivered");
    if (driverFilter === "all") return withCoords;
    return withCoords.filter((o) => driverOrderIds.has(o.pkgplace_id));
  }, [orders, driverFilter, driverOrderIds]);

  // Auction houses that have pending pickups (requested/ready)
  const activeAuctionHouseNames = useMemo(() => {
    return new Set(
      orders
        .filter((o) => o.delivery_status === "requested" || o.delivery_status === "ready")
        .map((o) => (o.auction_house || "").toLowerCase())
    );
  }, [orders]);

  const getMarkerColor = (order: Tables<"orders">) => {
    const isPickup = order.delivery_status === "requested" || order.delivery_status === "ready";
    if (isPickup) return { background: "hsl(205, 80%, 50%)", glyphColor: "#fff", borderColor: "hsl(205, 80%, 40%)" };
    if (order.payment_status === "unpaid") return { background: "hsl(0, 72%, 50%)", glyphColor: "#fff", borderColor: "hsl(0, 72%, 40%)" };
    return { background: "hsl(152, 60%, 40%)", glyphColor: "#fff", borderColor: "hsl(152, 60%, 30%)" };
  };

  const toggleOrderSelect = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (buildMode === "polygon") {
      setPolygonPoints((prev) => [...prev, { lat, lng }]);
    }
  }, [buildMode]);

  const closePolygon = () => {
    if (polygonPoints.length < 3) return;
    const inside = visibleOrders
      .filter((o) => pointInPolygon({ lat: o.latitude!, lng: o.longitude! }, polygonPoints))
      .map((o) => o.pkgplace_id);
    setSelectedOrderIds((prev) => new Set([...prev, ...inside]));
    setPolygonPoints([]);
    setBuildMode("click");
  };

  const clearBuildMode = () => {
    setBuildMode("off");
    setSelectedOrderIds(new Set());
    setPolygonPoints([]);
  };

  const handleDispatch = async () => {
    if (!dispatchDriver || selectedOrderIds.size === 0) return;
    setDispatching(true);
    try {
      const orderIds = [...selectedOrderIds];
      const orderMap = new Map(orders.map((o) => [o.pkgplace_id, o]));

      let { data: existingRoute } = await supabase
        .from("routes").select("id").eq("driver_id", dispatchDriver).eq("route_date", dispatchDate).maybeSingle();

      let routeId: string;
      if (existingRoute) {
        routeId = existingRoute.id;
        await supabase.from("routes").update({ vehicle_id: dispatchVehicle || null, note: dispatchNote || null }).eq("id", routeId);
      } else {
        const { data: newRoute, error } = await supabase.from("routes").insert({
          driver_id: dispatchDriver,
          route_date: dispatchDate,
          vehicle_id: dispatchVehicle || null,
          note: dispatchNote || null,
        }).select("id").single();
        if (error) throw error;
        routeId = newRoute.id;
      }

      const { data: existingStops } = await supabase
        .from("route_orders").select("stop_order").eq("route_id", routeId)
        .order("stop_order", { ascending: false }).limit(1);
      let nextOrder = (existingStops?.[0]?.stop_order ?? -1) + 1;

      const routeOrders = orderIds.map((orderId, i) => {
        const order = orderMap.get(orderId);
        const isPickup = order && (order.delivery_status === "requested" || order.delivery_status === "ready");
        return { route_id: routeId, order_id: orderId, stop_order: nextOrder + i, stop_type: isPickup ? "pickup" as const : "delivery" as const };
      });

      const { error } = await supabase.from("route_orders").upsert(routeOrders, { onConflict: "route_id,order_id" });
      if (error) throw error;

      const deliveryIds = routeOrders.filter((ro) => ro.stop_type === "delivery").map((ro) => ro.order_id);
      if (deliveryIds.length) await supabase.from("orders").update({ delivery_status: "in_transit" }).in("pkgplace_id", deliveryIds);

      toast({ title: "Dispatched", description: `${orderIds.length} orders assigned to route.` });
      clearBuildMode();
      onOrdersChanged?.();
    } catch (err: any) {
      toast({ title: "Dispatch failed", description: err.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  const handleOptimize = async () => {
    if (!dispatchDriver) return;
    setOptimizing(true);
    try {
      const { data: route } = await supabase.from("routes").select("id").eq("driver_id", dispatchDriver).eq("route_date", dispatchDate).maybeSingle();
      if (!route) throw new Error("No route for this driver/date");
      const { error } = await supabase.functions.invoke("optimize-route", { body: { route_id: route.id } });
      if (error) throw error;
      toast({ title: "Route Optimized" });
    } catch (err: any) {
      toast({ title: "Optimization failed", description: err.message, variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

  if (!API_KEY) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Google Maps API key not configured</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[160px]" />
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by driver" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {buildMode === "off" ? (
          <Button variant="outline" size="sm" onClick={() => setBuildMode("click")}>
            <Layers className="mr-1.5 h-4 w-4" /> Build Route
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant={buildMode === "click" ? "default" : "outline"} size="sm" onClick={() => setBuildMode("click")}>
              <MousePointer className="mr-1.5 h-3.5 w-3.5" /> Click Select
            </Button>
            <Button variant={buildMode === "polygon" ? "default" : "outline"} size="sm" onClick={() => setBuildMode("polygon")}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Draw Fence
            </Button>
            {buildMode === "polygon" && polygonPoints.length >= 3 && (
              <Button size="sm" onClick={closePolygon}>Close & Select</Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearBuildMode}><X className="h-4 w-4" /></Button>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-info inline-block" /> Pickups</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-success inline-block" /> Paid</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-destructive inline-block" /> Unpaid</span>
        </div>
      </div>

      {buildMode !== "off" && (
        <p className="text-xs text-muted-foreground">
          {buildMode === "click"
            ? "Click any pin to select/deselect."
            : `Draw fence: ${polygonPoints.length} point${polygonPoints.length !== 1 ? "s" : ""} — need 3+ to close.`}
          {selectedOrderIds.size > 0 && <span className="ml-2 font-semibold text-foreground">{selectedOrderIds.size} selected</span>}
        </p>
      )}

      {/* Map */}
      <div className="rounded-lg border overflow-hidden" style={{ height: "600px" }}>
        <APIProvider apiKey={API_KEY}>
          <Map defaultCenter={{ lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG }} defaultZoom={11} mapId="admin-map" style={{ width: "100%", height: "100%" }}>
            {buildMode !== "off" && <MapClickHandler onMapClick={handleMapClick} />}

            {/* Warehouse */}
            <AdvancedMarker position={{ lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG }}>
              <Pin background="hsl(38, 92%, 50%)" glyphColor="#fff" borderColor="hsl(38, 92%, 40%)" scale={1.2} />
            </AdvancedMarker>

            {/* Order pins */}
            {visibleOrders.map((order) => {
              const colors = getMarkerColor(order);
              const isSelected = selectedOrderIds.has(order.pkgplace_id);
              return (
                <AdvancedMarker
                  key={order.pkgplace_id}
                  position={{ lat: order.latitude!, lng: order.longitude! }}
                  onClick={() => buildMode !== "off" && toggleOrderSelect(order.pkgplace_id)}
                >
                  <Pin
                    background={isSelected ? "hsl(280, 80%, 50%)" : colors.background}
                    glyphColor="#fff"
                    borderColor={isSelected ? "hsl(280, 80%, 40%)" : colors.borderColor}
                    scale={isSelected ? 1.3 : 1}
                  />
                </AdvancedMarker>
              );
            })}

            {/* Polygon preview vertices */}
            {polygonPoints.map((p, i) => (
              <AdvancedMarker key={`poly-${i}`} position={p}>
                <div className="h-3 w-3 rounded-full bg-purple-500 border-2 border-white shadow" />
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>
      </div>

      {/* Dispatch panel for build-route mode */}
      {buildMode !== "off" && selectedOrderIds.size > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Dispatch {selectedOrderIds.size} Selected Orders</p>
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrderIds(new Set())}>Clear selection</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={dispatchDriver} onValueChange={setDispatchDriver}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.display_name || d.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dispatchVehicle} onValueChange={setDispatchVehicle}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No vehicle</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="w-[160px]" />
              <Input placeholder="Route note (e.g. Hamilton West)" value={dispatchNote} onChange={(e) => setDispatchNote(e.target.value)} className="w-[220px]" />
              <Button onClick={handleDispatch} disabled={!dispatchDriver || dispatching}>
                <Send className="mr-2 h-4 w-4" />{dispatching ? "Dispatching..." : "Dispatch"}
              </Button>
              <Button variant="outline" onClick={handleOptimize} disabled={!dispatchDriver || optimizing}>
                <Zap className="mr-2 h-4 w-4" />{optimizing ? "Optimizing..." : "Optimize"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
