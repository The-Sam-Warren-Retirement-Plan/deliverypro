import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StopCard, { StopData } from "@/components/driver/StopCard";
import SkipDialog from "@/components/driver/SkipDialog";
import MultiPhotoUpload from "@/components/driver/MultiPhotoUpload";
import DriverHistory from "@/components/driver/DriverHistory";
import GeofencePrompt from "@/components/driver/GeofencePrompt";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, Truck, History } from "lucide-react";

export default function DriverView() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [stops, setStops] = useState<StopData[]>([]);
  const [filter, setFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [skipOrderId, setSkipOrderId] = useState<string | null>(null);
  const [deliverOrderId, setDeliverOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("route");

  const fetchStops = async () => {
    if (!user) return;
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];
    const { data: routes } = await supabase
      .from("routes")
      .select("id")
      .eq("driver_id", user.id)
      .eq("route_date", today);

    if (!routes?.length) { setStops([]); setLoading(false); return; }

    const routeIds = routes.map((r) => r.id);
    const { data: routeOrders } = await supabase
      .from("route_orders")
      .select("id, order_id, stop_order, stop_type, route_id")
      .in("route_id", routeIds)
      .order("stop_order");

    if (!routeOrders?.length) { setStops([]); setLoading(false); return; }

    const orderIds = routeOrders.map((ro) => ro.order_id);
    const { data: orders } = await supabase.from("orders").select("*").in("pkgplace_id", orderIds);
    const orderMap = new Map((orders || []).map((o) => [o.pkgplace_id, o]));

    const { data: archived } = await supabase.from("archived_stops").select("order_id").in("order_id", orderIds);
    const archivedSet = new Set((archived || []).map((a) => a.order_id));

    const stopData: StopData[] = routeOrders
      .filter((ro) => !archivedSet.has(ro.order_id) && orderMap.has(ro.order_id))
      .filter((ro) => orderMap.get(ro.order_id)!.delivery_status !== "delivered")
      .map((ro) => ({
        routeOrderId: ro.id,
        order: orderMap.get(ro.order_id)!,
        stopType: ro.stop_type,
        stopOrder: ro.stop_order,
      }));

    setStops(stopData);
    setLoading(false);
  };

  useEffect(() => { fetchStops(); }, [user]);

  const filtered = stops.filter((s) => filter === "all" || s.stopType === filter);

  const handleNavigate = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
  };

  const handleMarkPickedUp = async (orderId: string) => {
    await supabase.from("orders").update({ delivery_status: "in_warehouse" }).eq("pkgplace_id", orderId);
    toast({ title: "Picked up", description: `Order ${orderId} marked as in warehouse.` });
    fetchStops();
  };

  const handleTakePhoto = (orderId: string) => {
    setDeliverOrderId(orderId);
  };

  const handleMarkDelivered = (orderId: string) => {
    // Open multi-photo dialog instead of direct delivery
    setDeliverOrderId(orderId);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h1 className="font-bold">My Route</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main tabs: Route vs History */}
      <div className="sticky top-14 z-40 border-b bg-background px-4 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="route" className="gap-1"><Truck className="h-3.5 w-3.5" /> Today</TabsTrigger>
            <TabsTrigger value="history" className="gap-1"><History className="h-3.5 w-3.5" /> My History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "route" && (
        <>
          {/* Filters */}
          <div className="border-b bg-background px-4 py-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="all">All ({stops.length})</TabsTrigger>
                <TabsTrigger value="pickup">Pickups ({stops.filter((s) => s.stopType === "pickup").length})</TabsTrigger>
                <TabsTrigger value="delivery">Deliveries ({stops.filter((s) => s.stopType === "delivery").length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-3 p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Package className="h-12 w-12" />
                <p className="text-sm">No stops for today</p>
              </div>
            ) : (
              filtered.map((stop) => (
                <StopCard
                  key={stop.routeOrderId}
                  stop={stop}
                  onNavigate={handleNavigate}
                  onMarkPickedUp={handleMarkPickedUp}
                  onTakePhoto={handleTakePhoto}
                  onMarkDelivered={handleMarkDelivered}
                  onSkip={(id) => setSkipOrderId(id)}
                />
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "history" && <DriverHistory />}

      {/* Multi-photo delivery dialog */}
      <MultiPhotoUpload orderId={deliverOrderId} onClose={() => setDeliverOrderId(null)} onUploaded={fetchStops} />

      {/* Skip dialog */}
      <SkipDialog orderId={skipOrderId} onClose={() => setSkipOrderId(null)} onSkipped={fetchStops} />

      {/* Geofence prompt */}
      <GeofencePrompt hasActiveStops={stops.length > 0} />
    </div>
  );
}
