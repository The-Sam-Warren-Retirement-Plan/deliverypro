
-- Create enums
CREATE TYPE public.delivery_status AS ENUM ('requested', 'ready', 'in_warehouse', 'out_for_delivery', 'delivered');
CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');
CREATE TYPE public.stop_type AS ENUM ('pickup', 'delivery');
CREATE TYPE public.archive_reason AS ENUM ('business_closed', 'customer_not_home', 'access_code_required', 'safety_weather', 'package_damaged');

-- Orders table
CREATE TABLE public.orders (
  pkgplace_id TEXT PRIMARY KEY,
  delivery_status public.delivery_status NOT NULL DEFAULT 'requested',
  auction_house TEXT,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  customer_name TEXT,
  address TEXT,
  address_line2 TEXT,
  zip_code TEXT,
  zone TEXT,
  phone TEXT,
  email TEXT,
  delivery_instructions TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Routes table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Route orders junction table
CREATE TABLE public.route_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES public.orders(pkgplace_id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 0,
  stop_type public.stop_type NOT NULL DEFAULT 'delivery',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(route_id, order_id)
);

-- Archived stops
CREATE TABLE public.archived_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(pkgplace_id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason public.archive_reason NOT NULL,
  notes TEXT,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Orders: admins full access, drivers read-only + update status/photo
CREATE POLICY "Admins full access to orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view orders on their routes" ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver') AND (
      EXISTS (
        SELECT 1 FROM public.route_orders ro
        JOIN public.routes r ON r.id = ro.route_id
        WHERE ro.order_id = orders.pkgplace_id AND r.driver_id = auth.uid()
      )
    )
  );

CREATE POLICY "Drivers can update order status and photo" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver') AND EXISTS (
      SELECT 1 FROM public.route_orders ro
      JOIN public.routes r ON r.id = ro.route_id
      WHERE ro.order_id = orders.pkgplace_id AND r.driver_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'driver')
  );

-- Routes: admins full access, drivers see their own
CREATE POLICY "Admins full access to routes" ON public.routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their routes" ON public.routes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'driver') AND driver_id = auth.uid());

-- Route orders: admins full, drivers see/update their own
CREATE POLICY "Admins full access to route_orders" ON public.route_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their route orders" ON public.route_orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver') AND EXISTS (
      SELECT 1 FROM public.routes r WHERE r.id = route_orders.route_id AND r.driver_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update stop order" ON public.route_orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver') AND EXISTS (
      SELECT 1 FROM public.routes r WHERE r.id = route_orders.route_id AND r.driver_id = auth.uid()
    )
  );

-- Archived stops: admins full, drivers can insert
CREATE POLICY "Admins full access to archived_stops" ON public.archived_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can archive their stops" ON public.archived_stops FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'driver') AND driver_id = auth.uid()
  );

CREATE POLICY "Drivers can view their archived stops" ON public.archived_stops FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'driver') AND driver_id = auth.uid());

-- Profiles: viewable by authenticated, updatable by owner
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- User roles: only admins can manage, users can read own
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Storage bucket for delivery photos
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-photos', 'delivery-photos', true);

CREATE POLICY "Authenticated users can upload delivery photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-photos');

CREATE POLICY "Anyone can view delivery photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'delivery-photos');

-- Indexes for performance
CREATE INDEX idx_orders_delivery_status ON public.orders(delivery_status);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_auction_house ON public.orders(auction_house);
CREATE INDEX idx_routes_driver_id ON public.routes(driver_id);
CREATE INDEX idx_routes_route_date ON public.routes(route_date);
CREATE INDEX idx_route_orders_route_id ON public.route_orders(route_id);
CREATE INDEX idx_route_orders_order_id ON public.route_orders(order_id);
