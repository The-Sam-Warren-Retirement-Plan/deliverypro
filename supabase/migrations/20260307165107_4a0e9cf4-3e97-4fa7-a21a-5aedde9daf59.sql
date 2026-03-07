
-- Add fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_driver boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';

-- Create vehicles table
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer,
  make text NOT NULL,
  model text NOT NULL,
  vin text UNIQUE,
  current_mileage integer DEFAULT 0,
  mileage_of_last_oil_change integer DEFAULT 0,
  insurance_url text,
  registration_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to vehicles" ON public.vehicles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can view vehicles" ON public.vehicles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'driver'));

-- Create maintenance_logs table
CREATE TABLE public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  mileage_at_service integer,
  cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to maintenance_logs" ON public.maintenance_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add vehicle_id to routes
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id);

-- Create delivery_proof_photos table
CREATE TABLE public.delivery_proof_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(pkgplace_id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_proof_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to delivery_proof_photos" ON public.delivery_proof_photos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can insert delivery photos" ON public.delivery_proof_photos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'driver'));
CREATE POLICY "Drivers can view their photos" ON public.delivery_proof_photos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'driver'));

-- Create daily_logs table for geofencing events
CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  event_type text NOT NULL,
  current_mileage integer,
  logged_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to daily_logs" ON public.daily_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can insert own logs" ON public.daily_logs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'driver') AND driver_id = auth.uid());
CREATE POLICY "Drivers can view own logs" ON public.daily_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'driver') AND driver_id = auth.uid());

-- Create delivery_proof storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery_proof', 'delivery_proof', true) ON CONFLICT DO NOTHING;

-- Storage RLS for delivery_proof
CREATE POLICY "Anyone can read delivery_proof" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'delivery_proof');
CREATE POLICY "Authenticated users can upload delivery_proof" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'delivery_proof');
