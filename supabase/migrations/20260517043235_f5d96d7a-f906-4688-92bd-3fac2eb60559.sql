CREATE TABLE public.materials_purchased (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL DEFAULT current_date,
  material text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'paid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.materials_purchased ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage materials purchased"
ON public.materials_purchased
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_materials_purchased_date ON public.materials_purchased(purchase_date DESC);
CREATE INDEX idx_materials_purchased_supplier ON public.materials_purchased(supplier_id);