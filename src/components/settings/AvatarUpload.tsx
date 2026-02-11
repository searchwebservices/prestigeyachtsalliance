import { useCallback, useRef, useState } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Trash2 } from "lucide-react";

const MAX_OUTPUT_PX = 256;
const QUALITY = 0.85;

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  fallbackInitials: string;
  onUploaded: (url: string | null) => void;
  disabled?: boolean;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

async function cropAndResize(
  image: HTMLImageElement,
  crop: Crop
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const cropX = (crop.x ?? 0) * scaleX;
  const cropY = (crop.y ?? 0) * scaleY;
  const cropW = (crop.width ?? 0) * scaleX;
  const cropH = (crop.height ?? 0) * scaleY;

  const size = Math.min(MAX_OUTPUT_PX, Math.max(cropW, cropH));
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/webp",
      QUALITY
    );
  });
}

export default function AvatarUpload({
  userId,
  currentUrl,
  fallbackInitials,
  onUploaded,
  disabled,
}: AvatarUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setDialogOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }, []);

  const handleUpload = async () => {
    if (!imgRef.current || !crop) return;
    setUploading(true);
    try {
      const blob = await cropAndResize(imgRef.current, crop);
      const filePath = `${userId}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (profileUpdateError) throw profileUpdateError;

      onUploaded(publicUrl);
      setDialogOpen(false);
      toast({
        title: "Avatar updated",
        description: "Your profile photo has been saved.",
      });
    } catch (err) {
      console.error("Avatar upload failed:", err);
      const message = err instanceof Error ? err.message : "Failed to upload avatar.";
      toast({
        variant: "destructive",
        title: "Avatar upload failed",
        description: message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { error: removeError } = await supabase.storage
        .from("avatars")
        .remove([`${userId}/avatar.webp`]);
      if (removeError) throw removeError;

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (profileUpdateError) throw profileUpdateError;

      onUploaded(null);
      toast({
        title: "Avatar removed",
        description: "Your profile photo has been removed.",
      });
    } catch (err) {
      console.error("Avatar remove failed:", err);
      const message = err instanceof Error ? err.message : "Failed to remove avatar.";
      toast({
        variant: "destructive",
        title: "Avatar remove failed",
        description: message,
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={currentUrl ?? undefined} alt="Profile avatar" />
          <AvatarFallback className="text-lg font-semibold bg-muted text-muted-foreground">
            {fallbackInitials}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Change avatar"
        >
          <Camera className="h-5 w-5 text-white" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Camera className="mr-2 h-4 w-4" />
          Change photo
        </Button>
        {currentUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || removing}
            className="text-destructive hover:text-destructive"
          >
            {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileSelect}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Avatar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-[400px]"
              >
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-h-[400px]"
                />
              </ReactCrop>
            )}
            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Avatar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
