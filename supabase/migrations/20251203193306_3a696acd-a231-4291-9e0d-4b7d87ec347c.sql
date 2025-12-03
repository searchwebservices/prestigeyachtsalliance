-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create yachts table
CREATE TABLE public.yachts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    vessel_type TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    team_description TEXT,
    sales_description TEXT,
    public_price DECIMAL(10, 2),
    commission_amount DECIMAL(10, 2),
    owner_notes TEXT,
    cal_embed_url TEXT,
    is_flagship BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on yachts
ALTER TABLE public.yachts ENABLE ROW LEVEL SECURITY;

-- RLS policies for yachts - authenticated users can view
CREATE POLICY "Authenticated users can view yachts"
ON public.yachts
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify yachts
CREATE POLICY "Admins can manage yachts"
ON public.yachts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create yacht_images table
CREATE TABLE public.yacht_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yacht_id UUID REFERENCES public.yachts(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on yacht_images
ALTER TABLE public.yacht_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for yacht_images
CREATE POLICY "Authenticated users can view yacht images"
ON public.yacht_images
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage yacht images"
ON public.yacht_images
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for yachts updated_at
CREATE TRIGGER update_yachts_updated_at
    BEFORE UPDATE ON public.yachts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();