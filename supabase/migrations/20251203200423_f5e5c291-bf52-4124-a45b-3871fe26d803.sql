-- Create storage bucket for yacht images
INSERT INTO storage.buckets (id, name, public) VALUES ('yacht-images', 'yacht-images', true);

-- Allow authenticated users to view yacht images
CREATE POLICY "Anyone can view yacht images"
ON storage.objects FOR SELECT
USING (bucket_id = 'yacht-images');

-- Allow admins to upload yacht images
CREATE POLICY "Admins can upload yacht images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'yacht-images' AND has_role(auth.uid(), 'admin'));

-- Allow admins to update yacht images
CREATE POLICY "Admins can update yacht images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'yacht-images' AND has_role(auth.uid(), 'admin'));

-- Allow admins to delete yacht images
CREATE POLICY "Admins can delete yacht images"
ON storage.objects FOR DELETE
USING (bucket_id = 'yacht-images' AND has_role(auth.uid(), 'admin'));