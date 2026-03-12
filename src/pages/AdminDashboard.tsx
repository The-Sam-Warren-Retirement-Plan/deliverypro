import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusOverview from "@/components/admin/StatusOverview";
import CsvUpload from "@/components/admin/CsvUpload";
import OrdersTable from "@/components/admin/OrdersTable";
import DispatchPanel from "@/components/admin/DispatchPanel";
import DriverManagement from "@/components/admin/DriverManagement";
import VehicleManagement from "@/components/admin/VehicleManagement";
import AdminMapView from "@/components/admin/AdminMapView";
import AuctionHouseManager from "@/components/admin/AuctionHouseManager";
import RouteHistory from "@/components/admin/RouteHistory";
import AddOrderModal from "@/components/admin/AddOrderModal";
import { LogOut, Package, Send, Users, Car, Map, Building2, Route, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [orders, setOrders] = useState<Tables<"orders">[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOrderOpen, setAddOrderOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold">DeliveryPro</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOrderOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Order
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <StatusOverview orders={orders} />

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="orders" className="gap-2"><Package className="h-4 w-4" /> Orders</TabsTrigger>
            <TabsTrigger value="dispatch" className="gap-2"><Send className="h-4 w-4" /> Dispatch</TabsTrigger>
            <TabsTrigger value="map" className="gap-2"><Map className="h-4 w-4" /> Map</TabsTrigger>
            <TabsTrigger value="routes" className="gap-2"><Route className="h-4 w-4" /> Routes</TabsTrigger>
            <TabsTrigger value="auction-houses" className="gap-2"><Building2 className="h-4 w-4" /> Auction Houses</TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2"><Users className="h-4 w-4" /> Drivers</TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2"><Car className="h-4 w-4" /> Vehicles</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <CsvUpload onImported={fetchOrders} />
            <OrdersTable orders={orders} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onOrdersChanged={fetchOrders} />
          </TabsContent>

          <TabsContent value="dispatch" className="space-y-4">
            <OrdersTable orders={orders} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onOrdersChanged={fetchOrders} />
            <DispatchPanel selectedOrderIds={selectedIds} orders={orders} onDispatched={() => { setSelectedIds([]); fetchOrders(); }} />
          </TabsContent>

          <TabsContent value="map">
            <AdminMapView orders={orders} onOrdersChanged={fetchOrders} />
          </TabsContent>

          <TabsContent value="routes">
            <RouteHistory />
          </TabsContent>

          <TabsContent value="auction-houses">
            <AuctionHouseManager />
          </TabsContent>

          <TabsContent value="drivers"><DriverManagement /></TabsContent>
          <TabsContent value="vehicles"><VehicleManagement /></TabsContent>
        </Tabs>
      </main>

      <AddOrderModal open={addOrderOpen} onClose={() => setAddOrderOpen(false)} onCreated={fetchOrders} />
    </div>
  );
}
