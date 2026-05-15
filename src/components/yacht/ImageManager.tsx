import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  Trash2,
  Crop,
  Star,
  Loader2,
  Image as ImageIcon,
  Images,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ImageCropper from './ImageCropper';

const MAX_BATCH_SIZE = 30;

interface YachtImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  display_order: number | null;
}

interface ImageManagerProps {
  yachtId: string;
  yachtName: string;
  images: YachtImage[];
  onUpdate: () => void;
}

export default function ImageManager({ yachtId, yachtName, images, onUpdate }: ImageManagerProps) {
  const { toast } = useToast();
  const singleInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<{ id: string; url: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ── Single upload (with cropper) ──────────────────────────────────────────

  const handleSingleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadSingleBlob = async (blob: Blob) => {
    setIsUploading(true);
    setPreviewImage(null);
    try {
      const fileName = `${yachtId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('yacht-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('yacht-images').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('yacht_images').insert({
        yacht_id: yachtId,
        image_url: publicUrl,
        alt_text: yachtName,
        is_primary: images.length === 0,
        display_order: images.length,
      });
      if (dbError) throw dbError;

      toast({ title: 'Image uploaded', description: 'The image has been added to the gallery.' });
      onUpdate();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message || 'Failed to upload image.' });
    } finally {
      setIsUploading(false);
      if (singleInputRef.current) singleInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (cropImage) {
      setIsUploading(true);
      try {
        const fileName = `${yachtId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('yacht-images')
          .upload(fileName, croppedBlob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('yacht-images').getPublicUrl(fileName);
        const { error: dbError } = await supabase
          .from('yacht_images')
          .update({ image_url: publicUrl })
          .eq('id', cropImage.id);
        if (dbError) throw dbError;

        toast({ title: 'Image cropped', description: 'The image has been updated.' });
        onUpdate();
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Crop failed', description: error.message || 'Failed to save cropped image.' });
      } finally {
        setIsUploading(false);
        setCropImage(null);
      }
    } else if (previewImage) {
      uploadSingleBlob(croppedBlob);
    }
  };

  // ── Batch upload (no cropper) ─────────────────────────────────────────────

  const handleBatchSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const capped = imageFiles.slice(0, MAX_BATCH_SIZE);

    if (imageFiles.length > MAX_BATCH_SIZE) {
      toast({
        title: `Capped at ${MAX_BATCH_SIZE} images`,
        description: `${imageFiles.length} selected — only the first ${MAX_BATCH_SIZE} will be uploaded.`,
      });
    }
    if (imageFiles.length === 0) {
      toast({ variant: 'destructive', title: 'No images selected', description: 'Please select image files.' });
      return;
    }

    setIsUploading(true);
    setBatchProgress({ done: 0, total: capped.length });

    let successCount = 0;
    const baseOrder = images.length;

    for (let i = 0; i < capped.length; i++) {
      const file = capped[i];
      try {
        const fileName = `${yachtId}/${Date.now()}-${i}.${file.name.split('.').pop() || 'jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('yacht-images')
          .upload(fileName, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('yacht-images').getPublicUrl(fileName);
        const { error: dbError } = await supabase.from('yacht_images').insert({
          yacht_id: yachtId,
          image_url: publicUrl,
          alt_text: yachtName,
          is_primary: images.length === 0 && i === 0,
          display_order: baseOrder + i,
        });
        if (dbError) throw dbError;

        successCount++;
      } catch (err: any) {
        console.error(`Failed to upload ${file.name}:`, err);
      }
      setBatchProgress({ done: i + 1, total: capped.length });
    }

    setIsUploading(false);
    setBatchProgress(null);
    if (batchInputRef.current) batchInputRef.current.value = '';

    if (successCount === capped.length) {
      toast({ title: `${successCount} image${successCount !== 1 ? 's' : ''} uploaded`, description: 'All images have been added to the gallery.' });
    } else {
      toast({
        variant: 'destructive',
        title: `${successCount} of ${capped.length} uploaded`,
        description: 'Some images failed to upload.',
      });
    }
    onUpdate();
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteImageId) return;
    try {
      const imageToDelete = images.find((img) => img.id === deleteImageId);
      if (imageToDelete?.image_url) {
        const path = imageToDelete.image_url.split('/yacht-images/')[1];
        if (path) await supabase.storage.from('yacht-images').remove([path]);
      }
      const { error } = await supabase.from('yacht_images').delete().eq('id', deleteImageId);
      if (error) throw error;
      toast({ title: 'Image deleted', description: 'The image has been removed from the gallery.' });
      onUpdate();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message || 'Failed to delete image.' });
    } finally {
      setDeleteImageId(null);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      await supabase.from('yacht_images').update({ is_primary: false }).eq('yacht_id', yachtId);
      const { error } = await supabase.from('yacht_images').update({ is_primary: true }).eq('id', imageId);
      if (error) throw error;
      toast({ title: 'Primary image updated', description: 'This image will now be shown as the main photo.' });
      onUpdate();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message || 'Failed to update primary image.' });
    }
  };

  const progressPct = batchProgress ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border-dashed border-2 border-border/50 bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <input ref={singleInputRef} type="file" accept="image/*" onChange={handleSingleSelect} className="hidden" />
          <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={handleBatchSelect} className="hidden" />

          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </div>

          {batchProgress ? (
            <>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Uploading {batchProgress.done} of {batchProgress.total}…
              </h3>
              <div className="w-full max-w-xs mb-4">
                <Progress value={progressPct} className="h-2" />
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {isUploading ? 'Uploading…' : 'Upload Images'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Add a single image with crop control, or batch-upload up to {MAX_BATCH_SIZE} at once.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => singleInputRef.current?.click()} disabled={isUploading} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Single
                </Button>
                <Button onClick={() => batchInputRef.current?.click()} disabled={isUploading}>
                  <Images className="w-4 h-4 mr-2" />
                  Batch Upload
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Image Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="group relative overflow-hidden border-border/50">
              <div className="aspect-video relative">
                <img
                  src={image.image_url}
                  alt={image.alt_text || yachtName}
                  className="w-full h-full object-cover"
                />
                {image.is_primary && (
                  <Badge className="absolute top-2 left-2 bg-gold text-primary-foreground border-0 gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Primary
                  </Badge>
                )}
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!image.is_primary && (
                    <Button size="sm" variant="secondary" onClick={() => handleSetPrimary(image.id)} title="Set as primary">
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setCropImage({ id: image.id, url: image.image_url })} title="Crop image">
                    <Crop className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteImageId(image.id)} title="Delete image">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
          <p>No images uploaded yet.</p>
        </div>
      )}

      {/* Crop Dialog for new single uploads */}
      {previewImage && (
        <ImageCropper
          open={!!previewImage}
          onClose={() => {
            setPreviewImage(null);
            if (singleInputRef.current) singleInputRef.current.value = '';
          }}
          imageSrc={previewImage}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Crop Dialog for existing images */}
      {cropImage && (
        <ImageCropper
          open={!!cropImage}
          onClose={() => setCropImage(null)}
          imageSrc={cropImage.url}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteImageId} onOpenChange={() => setDeleteImageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
