import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import type { StopData } from "./StopCard";

const WAREHOUSE_LAT = 43.6629;
const WAREHOUSE_LNG = -79.6197;
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface Props {
  stops: StopData[];
}

export default function DriverMapView({ stops }: Props) {
  const stopsWithCoords = stops.filter((s) => s.order.latitude && s.order.longitude);

  if (!API_KEY) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Map not available</div>;
  }

  const center = stopsWithCoords.length > 0
    ? { lat: stopsWithCoords[0].order.latitude!, lng: stopsWithCoords[0].order.longitude! }
    : { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG };

  return (
    <div className="p-4">
      <div className="rounded-lg border overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        <APIProvider apiKey={API_KEY}>
          <Map defaultCenter={center} defaultZoom={12} mapId="driver-map" style={{ width: "100%", height: "100%" }}>
            <AdvancedMarker position={{ lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG }}>
              <Pin background="hsl(38, 92%, 50%)" glyphColor="#fff" borderColor="hsl(38, 92%, 40%)" scale={1.2} />
            </AdvancedMarker>

            {stopsWithCoords.map((s, i) => {
              const isPickup = s.stopType === "pickup";
              const isUnpaid = s.order.payment_status === "unpaid";
              const bg = isPickup ? "hsl(205, 80%, 50%)" : isUnpaid ? "hsl(0, 72%, 50%)" : "hsl(152, 60%, 40%)";
              const border = isPickup ? "hsl(205, 80%, 40%)" : isUnpaid ? "hsl(0, 72%, 40%)" : "hsl(152, 60%, 30%)";
              return (
                <AdvancedMarker key={s.routeOrderId} position={{ lat: s.order.latitude!, lng: s.order.longitude! }}>
                  <Pin background={bg} glyphColor="#fff" borderColor={border} glyph={`${i + 1}`} />
                </AdvancedMarker>
              );
            })}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
