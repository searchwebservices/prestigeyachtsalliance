
ALTER TABLE public.reservation_details
  ADD COLUMN IF NOT EXISTS created_by_email text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_reservation_details_yacht_time
  ON public.reservation_details (yacht_slug, start_at, end_at);

CREATE OR REPLACE FUNCTION public.create_public_reservation(
  p_yacht_slug text,
  p_yacht_name text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_attendee_name text,
  p_attendee_email text,
  p_attendee_phone text,
  p_notes text
)
RETURNS TABLE (id uuid, booking_uid text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_count int;
  v_buffer interval := interval '2 hours';
  v_uid text;
  v_guest_id uuid;
  v_reservation_id uuid;
BEGIN
  IF p_yacht_slug IS NULL OR p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'invalid_range';
  END IF;

  SELECT count(*) INTO v_conflict_count
  FROM public.reservation_details rd
  WHERE rd.yacht_slug = p_yacht_slug
    AND rd.status <> 'cancelled'
    AND tstzrange(rd.start_at - v_buffer, rd.end_at + v_buffer, '[)')
        && tstzrange(p_start_at, p_end_at, '[)');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  INSERT INTO public.guest_profiles (full_name, email, phone)
  VALUES (coalesce(p_attendee_name, ''), coalesce(p_attendee_email, ''), coalesce(p_attendee_phone, ''))
  RETURNING id INTO v_guest_id;

  v_uid := 'internal_' || gen_random_uuid()::text;

  INSERT INTO public.reservation_details (
    booking_uid_current,
    yacht_slug,
    yacht_name,
    start_at,
    end_at,
    status,
    guest_profile_id,
    source,
    concierge_notes,
    created_by_email
  ) VALUES (
    v_uid,
    p_yacht_slug,
    coalesce(p_yacht_name, ''),
    p_start_at,
    p_end_at,
    'booked',
    v_guest_id,
    'public_v2_no_cal',
    coalesce(p_notes, ''),
    coalesce(p_attendee_email, '')
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT v_reservation_id, v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_reservation(text, text, timestamptz, timestamptz, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_public_reservation(text, text, timestamptz, timestamptz, text, text, text, text) TO anon, authenticated;
