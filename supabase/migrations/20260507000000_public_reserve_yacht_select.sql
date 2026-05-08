-- Public-facing /reserve booking flow needs anonymous SELECT on yachts that are
-- explicitly enabled for public booking. The internal team-only policies remain
-- unchanged; this is purely additive for the `anon` role.

CREATE POLICY "Public can view publicly bookable yachts"
ON public.yachts
FOR SELECT
TO anon
USING (
  booking_public_enabled = true
  AND booking_mode = 'policy_v2'
  AND cal_event_type_id IS NOT NULL
);

CREATE POLICY "Public can view images of publicly bookable yachts"
ON public.yacht_images
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.yachts y
    WHERE y.id = yacht_images.yacht_id
      AND y.booking_public_enabled = true
      AND y.booking_mode = 'policy_v2'
      AND y.cal_event_type_id IS NOT NULL
  )
);
