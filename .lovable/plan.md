

## Overnight Delivery Logistics App — Updated Plan

### 1. Backend (Lovable Cloud + Supabase)

**Orders table** (mapped from CSV):
- pkgplace_id (PK, from "PkgPlace ID") — this is the Order ID
- delivery_status (from "Delivery Status": requested, ready, in_warehouse, out_for_delivery, delivered)
- auction_house (from "Auction House")
- payment_status (paid/unpaid, from "Payment Status")
- customer_name (from "Customer")
- address (from "Address")
- address_line2 (from "Address line 2")
- zip_code (from "Zip Code")
- zone (from "Zone")
- phone (from "Phone")
- email (from "Email")
- delivery_instructions (from "Delivery Instructions")
- photo_url (for proof-of-delivery)
- created_at (auto-generated timestamp)

**Ignored CSV columns:** Invoice #, Invoice ID, Price, Created On

**Other tables:** routes, route_orders (junction with stop_order), archived_stops (with reason enum), profiles, user_roles (admin/driver with secure RLS + has_role() function)

**Storage:** delivery-photos bucket

**Edge Functions:**
- **import-orders** — Fixed CSV parser mapping the exact columns above, skipping ignored fields
- **update-order-status** — REST POST endpoint accepting `{ pkgplace_id, status }`, secured with API key

**Auth:** Email/password, role-based (admin/driver)

---

### 2. Admin Dashboard (Desktop)
- Drag-and-drop CSV upload with fixed parser
- Orders table with search/filter/inline editing
- Status Overview bar (counts per delivery stage)
- Dispatch screen: multi-select orders → assign to driver + route date

### 3. Driver Mobile View
- Unified Stops timeline with All/Pickups/Deliveries filters
- Drag-and-drop reordering of stop cards
- **Pickup cards** (Box icon, blue border): grouped by Auction House, "Navigate" + "Mark All Picked Up"
- **Delivery cards** (House icon, green border): grouped by Address, red badge for unpaid, "Navigate" + "Take Photo" + "Scan"
- Unpaid alerts: red banner + popup
- Cancel/Skip: reason dropdown → archives stop

### 4. Live Map (Google Maps)
- Blue pins (pickups), Green pins (deliveries), Red pins (unpaid deliveries)

### 5. Design
- Dark mode, responsive (desktop admin, mobile-first driver)

### 6. External API
- POST `/functions/v1/update-order-status` with `{ pkgplace_id, status }`

