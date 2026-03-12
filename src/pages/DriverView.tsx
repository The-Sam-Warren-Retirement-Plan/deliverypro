import { useState, useEffect, useMemo } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StopCard, { StopData, PickupGroup } from "@/components/driver/StopCard";
import SkipDialog from "@/components/driver/SkipDialog";
import MultiPhotoUpload from "@/components/driver/MultiPhotoUpload";
import DriverHistory from "@/components/driver/DriverHistory";
import GeofencePrompt from "@/components/driver/GeofencePrompt";
import DriverMapView from "@/components/driver/DriverMapView";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, Truck, History, Map as MapIcon, CheckCircle2, GripVertical } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AuctionHouse = Tables<"auction_houses">;

type RenderedStop = {
  id: string; // routeOrderId of first stop (used as drag id)
  stop: StopData;
  pickupGroup?: PickupGroup;
  relatedOrderIds?: string[];
  totalBoxes?: number;
};

function SortableStopItem({ item, ...props }: { item: RenderedStop } & Omit<React.ComponentProps<typeof StopCard>, "stop" | "pickupGroup" | "relatedOrderIds" | "totalBoxes">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-2">
      <button
        className="flex items-center px-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <StopCard
          stop={item.stop}
          pickupGroup={item.pickupGroup}
          relatedOrderIds={item.relatedOrderIds}
          totalBoxes={item.totalBoxes}
          {...props}
        />
      </div>
    </div>
  );
}

export default function DriverView() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [stops, setStops] = useState<StopData[]>([]);
  const [activeRouteIds, setActiveRouteIds] = useState<string[]>([]);
  const [renderedStops, setRenderedStops] = useState<RenderedStop[]>([]);
  const [filter, setFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [skipOrderId, setSkipOrderId] = useState<string | null>(null);
  const [deliverOrderId, setDeliverOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("route");
  const [auctionHouses, setAuctionHouses] = useState<AuctionHouse[]>([]);
  const [closingRoute, setClosingRoute] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    supabase.from("auction_houses").select("*").then(({ data }) => setAuctionHouses(data || []));
  }, []);

  const fetchStops = async () => {
    if (!user) return;
    setLoading(true);

    const { data: routes } = await supabase
      .from("routes")
      .select("id, route_date")
      .eq("driver_id", user.id)
      .is("closed_at", null);

    if (!routes?.length) { setStops([]); setActiveRouteIds([]); setRenderedStops([]); setLoading(false); return; }

    const routeIds = routes.map((r) => r.id);
    const { data: routeOrders } = await supabase
      .from("route_orders").select("id, order_id, stop_order, stop_type, route_id")
      .in("route_id", routeIds).order("stop_order");
    if (!routeOrders?.length) { setStops([]); setActiveRouteIds([]); setRenderedStops([]); setLoading(false); return; }

    const orderIds = routeOrders.map((ro) => ro.order_id);
    const { data: orders } = await supabase.from("orders").select("*").in("pkgplace_id", orderIds);
    const orderMap = new Map((orders || []).map((o) => [o.pkgplace_id, o]));

    const { data: archived } = await supabase.from("archived_stops").select("order_id").in("order_id", orderIds);
    const archivedSet = new Set((archived || []).map((a) => a.order_id));

    const pickupStatuses = ["requested", "ready"];
    const deliveryStatuses = ["picked_up", "warehouse", "in_transit"];
    const activeStatuses = [...pickupStatuses, ...deliveryStatuses];

    const stopData: StopData[] = routeOrders
      .filter((ro) => !archivedSet.has(ro.order_id) && orderMap.has(ro.order_id))
      .filter((ro) => activeStatuses.includes(orderMap.get(ro.order_id)!.delivery_status))
      .map((ro) => {
        const order = orderMap.get(ro.order_id)!;
        const computedStopType = pickupStatuses.includes(order.delivery_status) ? "pickup" : "delivery";
        return { routeOrderId: ro.id, routeId: ro.route_id, order, stopType: computedStopType, stopOrder: ro.stop_order };
      });

    const activeRouteIdSet = new Set(stopData.map((s) => s.routeId));
    setActiveRouteIds([...activeRouteIdSet]);
    setStops(stopData);
    setLoading(false);
  };

  useEffect(() => { fetchStops(); }, [user]);

  const auctionHouseMap = useMemo(
    () => new Map(auctionHouses.map((ah) => [ah.name.toLowerCase(), ah])),
    [auctionHouses]
  );

  const filtered = stops.filter((s) => filter === "all" || s.stopType === filter);

  const pickupGroups = useMemo(() => {
    const groups = new Map<string, PickupGroup>();
    filtered.filter((s) => s.stopType === "pickup").forEach((s) => {
      const key = s.order.auction_house || "Unknown";
      const ahInfo = auctionHouseMap.get(key.toLowerCase());
      const address = ahInfo?.address
        || [s.order.address, s.order.address_line2, s.order.zip_code].filter(Boolean).join(", ");
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
        existing.orderIds.push(s.order.pkgplace_id);
        existing.stops.push(s);
        existing.totalBoxes += s.order.box_count ?? 0;
      } else {
        groups.set(key, {
          auctionHouse: key, address, phone: ahInfo?.phone || null, instructions: ahInfo?.instructions || null,
          count: 1, orderIds: [s.order.pkgplace_id], stops: [s], totalBoxes: s.order.box_count ?? 0,
        });
      }
    });
    return groups;
  }, [filtered, auctionHouseMap]);

  const deliveryGroups = useMemo(() => {
    const map = new Map<string, { orderIds: string[]; totalBoxes: number }>();
    filtered.filter((s) => s.stopType === "delivery").forEach((s) => {
      const key = s.order.customer_name || s.order.pkgplace_id;
      const existing = map.get(key) || { orderIds: [], totalBoxes: 0 };
      existing.orderIds.push(s.order.pkgplace_id);
      existing.totalBoxes += s.order.box_count ?? 0;
      map.set(key, existing);
    });
    return map;
  }, [filtered]);

  // Build renderedStops from filtered, but allow drag reordering via state
  const computedRendered = useMemo((): RenderedStop[] => {
    const rendered: RenderedStop[] = [];
    const seenPickupGroups = new Set<string>();
    for (const s of filtered) {
      if (s.stopType === "pickup") {
        const key = s.order.auction_house || "Unknown";
        if (seenPickupGroups.has(key)) continue;
        seenPickupGroups.add(key);
        rendered.push({ id: s.routeOrderId, stop: s, pickupGroup: pickupGroups.get(key) });
      } else {
        const key = s.order.customer_name || s.order.pkgplace_id;
        const group = deliveryGroups.get(key);
        rendered.push({ id: s.routeOrderId, stop: s, relatedOrderIds: group?.orderIds, totalBoxes: group?.totalBoxes });
      }
    }
    return rendered;
  }, [filtered, pickupGroups, deliveryGroups]);

  // Sync renderedStops when data changes (but preserve drag order if ids match)
  useEffect(() => {
    setRenderedStops(computedRendered);
  }, [computedRendered]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = renderedStops.findIndex((r) => r.id === active.id);
    const newIdx = renderedStops.findIndex((r) => r.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(renderedStops, oldIdx, newIdx);
    setRenderedStops(reordered);
    // Write new stop_orders to DB
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      stop_order: idx,
    }));
    for (const u of updates) {
      await supabase.from("route_orders").update({ stop_order: u.stop_order }).eq("id", u.id);
    }
  };

  const handleNavigate = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
  };

  const handleMarkPickedUp = async (orderId: string) => {
    await supabase.from("orders").update({ delivery_status: "picked_up" }).eq("pkgplace_id", orderId);
    toast({ title: "Picked up", description: `Order ${orderId} marked as picked up.` });
    fetchStops();
  };

  const handleTakePhoto = (orderId: string) => setDeliverOrderId(orderId);
  const handleMarkDelivered = (orderId: string) => setDeliverOrderId(orderId);

  const handleCloseRoute = async () => {
    if (activeRouteIds.length === 0) return;
    setClosingRoute(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("routes").update({ closed_at: now }).in("id", activeRouteIds);
      if (error) throw error;
      toast({ title: "Route closed", description: "All stops completed. Route has been closed." });
      fetchStops();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClosingRoute(false);
    }
  };

  const allDone = stops.length === 0 && activeRouteIds.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h1 className="font-bold">DeliveryPro</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="sticky top-14 z-40 border-b bg-background px-4 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="route" className="gap-1"><Truck className="h-3.5 w-3.5" /> Active</TabsTrigger>
            <TabsTrigger value="map" className="gap-1"><MapIcon className="h-3.5 w-3.5" /> Map</TabsTrigger>
            <TabsTrigger value="history" className="gap-1"><History className="h-3.5 w-3.5" /> History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "route" && (
        <>
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
            ) : allDone ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <p className="text-sm font-medium">All stops complete!</p>
                <Button onClick={handleCloseRoute} disabled={closingRoute} className="bg-success hover:bg-success/90 text-white">
                  {closingRoute ? "Closing..." : "Close Route"}
                </Button>
              </div>
            ) : renderedStops.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Package className="h-12 w-12" />
                <p className="text-sm">No active stops</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={renderedStops.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {renderedStops.map((rs) => (
                    <SortableStopItem
                      key={rs.id}
                      item={rs}
                      onNavigate={handleNavigate}
                      onMarkPickedUp={handleMarkPickedUp}
                      onTakePhoto={handleTakePhoto}
                      onMarkDelivered={handleMarkDelivered}
                      onSkip={(id) => setSkipOrderId(id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}

      {activeTab === "map" && <DriverMapView stops={stops} />}
      {activeTab === "history" && <DriverHistory />}

      <MultiPhotoUpload orderId={deliverOrderId} onClose={() => setDeliverOrderId(null)} onUploaded={fetchStops} />
      <SkipDialog orderId={skipOrderId} onClose={() => setSkipOrderId(null)} onSkipped={fetchStops} />
      <GeofencePrompt hasActiveStops={stops.length > 0} />
    </div>
  );
}
