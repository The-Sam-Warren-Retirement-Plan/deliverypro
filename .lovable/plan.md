

# DeliveryPro — Architectural & UI Overhaul

This is a large, multi-module update. I recommend implementing it in **3 phases** to keep changes manageable and testable.

---

## Phase 1: Database Schema + Branding + Status Model

### Database Migration
- **Alter `delivery_status` enum**: Drop old values, add new: `requested`, `ready`, `picked_up`, `warehouse`, `in_transit`, `delivered`
- **Add columns to `orders`**: `record_id` (UUID, auto-generated, unique), `latitude` (double precision), `longitude` (double precision), `formatted_address` (text)
- Update all code references to old statuses (`in_warehouse` → `warehouse`, `out_for_delivery` → `in_transit`)

### Branding
- Rename app to **DeliveryPro** in `index.html`, `Login.tsx`, `AdminDashboard.tsx` header

### Status Logic Updates
- **StatusOverview.tsx**: Update stages to REQUESTED, READY, PICKED UP, WAREHOUSE, IN TRANSIT, DELIVERED
- **OrdersTable.tsx**: Update filter options, status colors, status labels
- **CsvUpload.tsx**: Update `parseDeliveryStatus` mapper
- **DispatchPanel.tsx**: Change status update from `out_for_delivery` → `in_transit`
- **StopCard.tsx**: Update pickup/delivery logic — Pickups = `requested`/`ready`; Deliveries = `picked_up`/`warehouse`/`in_transit`
- **DriverView.tsx**: Update filter logic for new statuses
- **MultiPhotoUpload.tsx**: Status update to `delivered`

---

## Phase 2: Admin UI Enhancements + Driver History

### OrdersTable Enhancements
- **Green row backgrounds** for paid orders (conditional `className` on `TableRow`)
- **Sortable columns**: Add sort state + click handlers on Customer, Auction House, Zone headers with asc/desc toggle
- **Zone filter dropdown**: Extract unique zones from orders, add a Select filter
- **Bulk delete**: Add a "Delete Selected" button that removes selected orders
- **Delivery Notes modal**: Add a Dialog triggered by clicking a notes icon in each row — view/edit `delivery_instructions` inline

### Dispatch Enhancements
- **Stop type selection**: When dispatching, determine `stop_type` based on order status (requested/ready → pickup, others → delivery)
- **Vehicle assignment**: Add vehicle selector to DispatchPanel, save `vehicle_id` on route

### Driver History (Mobile)
- **Clickable routes**: Each history card expands/navigates to show stop list with order details
- **Delivery photos**: For each delivered order, fetch and display proof photos from `delivery_proof_photos`
- **Pickup display**: Show item count per auction house (e.g., "12 Items to Pick Up"), not individual IDs
- **Delivery display**: Show all Order IDs on the delivery card grouped by customer

---

## Phase 3: Google Maps Integration + Route Optimization + Geofencing

### Google Maps Setup
- Install `@vis.gl/react-google-maps`
- Use existing `VITE_GOOGLE_MAPS_API_KEY` secret (already configured)

### Auto-Geocoding on CSV Import
- After CSV parse, for rows missing lat/lng, call Google Geocoding API via an edge function (`geocode-addresses`)
- Store results in `latitude`, `longitude`, `formatted_address` on orders table
- Show progress bar in CsvUpload: "Converting addresses to map points..."

### Admin Map View
- New tab in AdminDashboard: "Map"
- Color-coded pins: Blue (pickups: requested/ready), Green (paid deliveries), Red (unpaid deliveries)
- "Filter by Driver" toggle: shows only orders on selected driver's routes

### Driver Map View
- New tab in driver mobile: "Map"
- Shows active route stops on Google Maps with navigation integration

### Route Optimization
- "Optimize Stop Order" button in DispatchPanel/Route Builder
- Edge function `optimize-route` calling Google Routes API v2 with `optimizeWaypointOrder: true`
- Warehouse (43.6629, -79.6197) as origin and destination
- Updates `stop_order` in `route_orders` table

### Geofencing
- Already implemented in `GeofencePrompt.tsx` — just needs status references updated for new enum values

---

## Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/migrations/...sql` | New migration for enum changes + new columns |
| `index.html` | Rename to DeliveryPro |
| `src/pages/Login.tsx` | Rename branding |
| `src/pages/AdminDashboard.tsx` | Add Map tab, rename header |
| `src/components/admin/StatusOverview.tsx` | New status stages |
| `src/components/admin/OrdersTable.tsx` | Sorting, zone filter, green rows, bulk delete, notes modal |
| `src/components/admin/CsvUpload.tsx` | New status parser, geocoding progress bar |
| `src/components/admin/DispatchPanel.tsx` | Vehicle assignment, stop_type logic |
| `src/components/admin/AdminMapView.tsx` | **New** — Google Maps with colored pins |
| `src/components/driver/StopCard.tsx` | Updated status logic, pickup count vs delivery IDs |
| `src/components/driver/DriverHistory.tsx` | Clickable routes with stop details + photos |
| `src/pages/DriverView.tsx` | Updated filters, map tab |
| `src/components/driver/DriverMapView.tsx` | **New** — Driver route map |
| `supabase/functions/geocode-addresses/index.ts` | **New** — Geocoding edge function |
| `supabase/functions/optimize-route/index.ts` | **New** — Route optimization edge function |

---

## Technical Notes

- The `delivery_status` enum change requires careful migration: add new values first, migrate existing data, then remove old values (Postgres doesn't allow direct rename of enum values easily — we'll add new values and update existing rows)
- Enum mapping: `in_warehouse` → `warehouse`, `out_for_delivery` → `in_transit`, keep `requested`/`ready`/`delivered` as-is, add `picked_up`
- The Google Maps API key is already stored as a secret — the edge functions will access it via `Deno.env.get("VITE_GOOGLE_MAPS_API_KEY")`
- `@vis.gl/react-google-maps` will be added as a dependency for frontend map components

