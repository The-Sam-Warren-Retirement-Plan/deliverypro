
-- Add new enum values for hub-and-spoke model
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'warehouse';
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'in_transit';

-- Add new columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS record_id uuid DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS formatted_address text;
