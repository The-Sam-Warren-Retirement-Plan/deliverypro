import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Package, Home, Camera, AlertTriangle, Navigation, X, StickyNote, Phone, Box } from "lucide-react";
import type { Tables, Enums } from "@/integrations/supabase/types";

export interface StopData {
  routeOrderId: string;
  routeId: string;
  order: Tables<"orders">;
  stopType: Enums<"stop_type">;
  stopOrder: number;
}

/** Grouped pickup data */
export interface PickupGroup {
  auctionHouse: string;
  address: string;
  phone: string | null;
  instructions: string | null;
  count: number;
  orderIds: string[];
  stops: StopData[];
  totalBoxes: number;
}

interface Props {
  stop: StopData;
  pickupGroup?: PickupGroup;
  relatedOrderIds?: string[];
  totalBoxes?: number;
  onNavigate: (address: string) => void;
  onMarkPickedUp: (orderId: string) => void;
  onTakePhoto: (orderId: string) => void;
  onMarkDelivered: (orderId: string) => void;
  onSkip: (orderId: string) => void;
}

export default function StopCard({ stop, pickupGroup, relatedOrderIds, totalBoxes, onNavigate, onMarkPickedUp, onTakePhoto, onMarkDelivered, onSkip }: Props) {
  const { order, stopType } = stop;
  const isPickup = stopType === "pickup";
  const isUnpaid = order.payment_status === "unpaid";

  const address = isPickup && pickupGroup
    ? pickupGroup.address
    : [order.address, order.address_line2, order.zip_code].filter(Boolean).join(", ");

  const hasNotes = !isPickup && !!order.delivery_instructions;
  const hasPickupInstructions = isPickup && !!(pickupGroup?.instructions);
  const boxCount = totalBoxes !== undefined ? totalBoxes : (order.box_count ?? 0);

  return (
    <Card className={`relative overflow-hidden border-l-4 ${
      isPickup ? "border-l-pickup" : isUnpaid ? "border-l-unpaid" : "border-l-delivery"
    }`}>
      {isUnpaid && !isPickup && (
        <div className="flex items-center gap-2 bg-destructive/10 px-4 py-1.5 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          UNPAID — Collect payment before delivery
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isPickup ? "bg-pickup/10 text-pickup" : "bg-delivery/10 text-delivery"
            }`}>
              {isPickup ? <Package className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              {isPickup && pickupGroup ? (
                <>
                  <p className="font-semibold text-sm">{pickupGroup.auctionHouse}</p>
                  <p className="text-xs font-medium text-pickup">{pickupGroup.count} Items to Pick Up</p>
                  {pickupGroup.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />{pickupGroup.phone}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm">{order.customer_name}</p>
                  {relatedOrderIds && relatedOrderIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Orders: {relatedOrderIds.join(", ")}
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {address || "No address"}
              </p>
              {boxCount > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Box className="h-3 w-3" />
                  {boxCount} box{boxCount !== 1 ? "es" : ""}
                </p>
              )}
            </div>
          </div>

          {/* Right-side badges + notes icon */}
          <div className="flex items-center gap-1 shrink-0">
            {isUnpaid && !isPickup && <Badge variant="destructive" className="text-[10px]">UNPAID</Badge>}
            {order.zone && <Badge variant="secondary" className="text-[10px]">{order.zone}</Badge>}

            {/* Notes icon for delivery */}
            {hasNotes && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="ml-1 text-warning hover:text-warning/80 transition-colors">
                    <StickyNote className="h-5 w-5 fill-warning/20" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm p-3" align="end">
                  <p className="font-medium text-xs mb-1 text-muted-foreground">Delivery Notes</p>
                  <p>{order.delivery_instructions}</p>
                </PopoverContent>
              </Popover>
            )}

            {/* Instructions icon for pickup */}
            {hasPickupInstructions && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="ml-1 text-warning hover:text-warning/80 transition-colors">
                    <StickyNote className="h-5 w-5 fill-warning/20" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm p-3" align="end">
                  <p className="font-medium text-xs mb-1 text-muted-foreground">Pickup Instructions</p>
                  <p>{pickupGroup!.instructions}</p>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onNavigate(address)}>
            <Navigation className="mr-1.5 h-3.5 w-3.5" /> Navigate
          </Button>
          {isPickup ? (
            <Button size="sm" className="bg-pickup hover:bg-pickup/90 text-pickup-foreground" onClick={() => {
              if (pickupGroup) {
                pickupGroup.orderIds.forEach((id) => onMarkPickedUp(id));
              } else {
                onMarkPickedUp(order.pkgplace_id);
              }
            }}>
              <Package className="mr-1.5 h-3.5 w-3.5" /> Mark All Picked Up
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => onTakePhoto(order.pkgplace_id)}>
                <Camera className="mr-1.5 h-3.5 w-3.5" /> Photo
              </Button>
              <Button size="sm" className="bg-delivery hover:bg-delivery/90 text-delivery-foreground" onClick={() => onMarkDelivered(order.pkgplace_id)}>
                Mark Delivered
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onSkip(order.pkgplace_id)}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
