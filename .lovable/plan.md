
## DeliveryPro — Implementation Plan (Current State)

All 3 phases implemented.

### Phase 1 ✅ — Database + Branding + Status Model
- `delivery_status` enum expanded: `requested`, `ready`, `picked_up`, `warehouse`, `in_transit`, `delivered`
- `orders` table: added `record_id` (UUID), `latitude`, `longitude`, `formatted_address`
- App renamed to **DeliveryPro** across Login, Admin, Driver views, and HTML meta
- All status references updated throughout codebase

### Phase 2 ✅ — Admin UI + Driver History
- **OrdersTable**: Green row backgrounds for paid, sortable columns (Customer/Auction House/Zone), Zone filter dropdown, bulk delete, delivery notes modal
- **DispatchPanel**: Vehicle assignment, stop_type auto-detection (pickup vs delivery based on status), Optimize Stop Order button
- **DriverHistory**: Clickable routes → dialog showing stop details + proof photos
- **StopCard**: Pickups show item count per auction house, deliveries show grouped order IDs

### Phase 3 ✅ — Google Maps + Geocoding + Route Optimization
- `@vis.gl/react-google-maps` installed, using `VITE_GOOGLE_MAPS_API_KEY`
- **AdminMapView**: Color-coded pins (Blue=pickups, Green=paid deliveries, Red=unpaid), Filter by Driver
- **DriverMapView**: Active route stops with numbered pins
- **Edge Functions**: `geocode-addresses` (auto-geocode on CSV import with progress bar), `optimize-route` (Google Routes API v2 with warehouse as origin/destination)
- **Geofencing**: 1km warehouse geofence with Start/Finish Day prompts, 30-min skip cooldown

### Hub-and-Spoke Status Flow
```
REQUESTED → READY → PICKED UP → WAREHOUSE → IN TRANSIT → DELIVERED
```
- Pickups = orders with `requested` or `ready` status
- Deliveries = orders with `picked_up`, `warehouse`, or `in_transit` status

### Warehouse Location
14-2470 Lucknow Dr, Mississauga, ON L5S 1J9, Canada (43.6629, -79.6197)
