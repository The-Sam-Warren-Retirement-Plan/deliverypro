import { Card, CardContent } from "@/components/ui/card";
import { Package, Warehouse, Truck, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  orders: Tables<"orders">[];
}

const stages = [
  { key: "requested", label: "Requested", icon: Clock, colorClass: "text-muted-foreground" },
  { key: "ready", label: "Ready", icon: Package, colorClass: "text-info" },
  { key: "picked_up", label: "Picked Up", icon: ArrowRight, colorClass: "text-pickup" },
  { key: "warehouse", label: "Warehouse", icon: Warehouse, colorClass: "text-warning" },
  { key: "in_transit", label: "In Transit", icon: Truck, colorClass: "text-primary" },
  { key: "delivered", label: "Delivered", icon: CheckCircle2, colorClass: "text-success" },
] as const;

export default function StatusOverview({ orders }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stages.map(({ key, label, icon: Icon, colorClass }) => {
        const count = orders.filter((o) => o.delivery_status === key).length;
        return (
          <Card key={key} className="border-none shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={`h-5 w-5 shrink-0 ${colorClass}`} />
              <div>
                <p className="text-2xl font-bold leading-none">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
