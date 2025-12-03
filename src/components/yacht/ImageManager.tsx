import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  GripVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ImageCropper from './ImageCropper';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<{ id: string; url: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please select an image file.',
      });
      return;
    }

    // Show preview for cropping
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (blob: Blob) => {
    setIsUploading(true);
    setPreviewImage(null);

    try {
      const fileName = `${yachtId}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('yacht-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('yacht-images')
        .getPublicUrl(fileName);

      // Add to yacht_images table
      const isFirst = images.length === 0;
      const { error: dbError } = await supabase
        .from('yacht_images')
        .insert({
          yacht_id: yachtId,
          image_url: publicUrl,
          alt_text: yachtName,
          is_primary: isFirst,
          display_order: images.length,
        });

      if (dbError) throw dbError;

      toast({
        title: 'Image uploaded',
        description: 'The image has been added to the gallery.',
      });
      onUpdate();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'Failed to upload image.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (cropImage) {
      // Re-upload cropped image
      setIsUploading(true);
      try {
        const fileName = `${yachtId}/${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('yacht-images')
          .upload(fileName, croppedBlob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('yacht-images')
          .getPublicUrl(fileName);

        // Update the image URL in the database
        const { error: dbError } = await supabase
          .from('yacht_images')
          .update({ image_url: publicUrl })
          .eq('id', cropImage.id);

        if (dbError) throw dbError;

        toast({
          title: 'Image cropped',
          description: 'The image has been updated.',
        });
        onUpdate();
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Crop failed',
          description: error.message || 'Failed to save cropped image.',
        });
      } finally {
        setIsUploading(false);
        setCropImage(null);
      }
    } else if (previewImage) {
      uploadImage(croppedBlob);
    }
  };

  const handleDelete = async () => {
    if (!deleteImageId) return;

    try {
      const imageToDelete = images.find((img) => img.id === deleteImageId);
      
      // Delete from storage
      if (imageToDelete?.image_url) {
        const path = imageToDelete.image_url.split('/yacht-images/')[1];
        if (path) {
          await supabase.storage.from('yacht-images').remove([path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('yacht_images')
        .delete()
        .eq('id', deleteImageId);

      if (error) throw error;

      toast({
        title: 'Image deleted',
        description: 'The image has been removed from the gallery.',
      });
      onUpdate();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message || 'Failed to delete image.',
      });
    } finally {
      setDeleteImageId(null);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      // First, unset all as primary
      await supabase
        .from('yacht_images')
        .update({ is_primary: false })
        .eq('yacht_id', yachtId);

      // Then set the selected one as primary
      const { error } = await supabase
        .from('yacht_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;

      toast({
        title: 'Primary image updated',
        description: 'This image will now be shown as the main photo.',
      });
      onUpdate();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message || 'Failed to update primary image.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border-dashed border-2 border-border/50 bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {isUploading ? 'Uploading...' : 'Upload New Image'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
            Select an image to upload. You'll be able to crop it before saving.
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Select Image
          </Button>
        </CardContent>
      </Card>

      {/* Image Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card
              key={image.id}
              className="group relative overflow-hidden border-border/50"
            >
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
                
                {/* Hover Actions */}
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!image.is_primary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetPrimary(image.id)}
                      title="Set as primary"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCropImage({ id: image.id, url: image.image_url })}
                    title="Crop image"
                  >
                    <Crop className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteImageId(image.id)}
                    title="Delete image"
                  >
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

      {/* Crop Dialog for new uploads */}
      {previewImage && (
        <ImageCropper
          open={!!previewImage}
          onClose={() => {
            setPreviewImage(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
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
