import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Anchor, Users, Star, Pencil, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface YachtCardProps {
  id: string;
  name: string;
  vesselType: string;
  capacity: number;
  isFlagship?: boolean;
  imageUrl?: string;
  isSelected?: boolean;
  isAdmin?: boolean;
  onClick?: () => void;
  onUpdate?: () => void;
  compact?: boolean;
}

export default function YachtCard({
  id,
  name,
  vesselType,
  capacity,
  isFlagship,
  imageUrl,
  isSelected,
  isAdmin,
  onClick,
  onUpdate,
  compact = false,
}: YachtCardProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editVesselType, setEditVesselType] = useState(vesselType);
  const [editCapacity, setEditCapacity] = useState(capacity);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editName.trim()) return;

    setIsSaving(true);
    const slug = editName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await supabase
      .from('yachts')
      .update({
        name: editName.trim(),
        vessel_type: editVesselType.trim(),
        capacity: editCapacity,
        slug,
      })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Saved', description: 'Yacht updated successfully.' });
      setIsEditing(false);
      onUpdate?.();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    // Delete images first, then yacht
    const { error: imgError } = await supabase
      .from('yacht_images')
      .delete()
      .eq('yacht_id', id);

    if (imgError) {
      toast({ variant: 'destructive', title: 'Error', description: imgError.message });
      setIsDeleting(false);
      return;
    }

    const { error } = await supabase.from('yachts').delete().eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Deleted', description: `${name} has been removed.` });
      onUpdate?.();
    }
    setIsDeleting(false);
  };

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(name);
    setEditVesselType(vesselType);
    setEditCapacity(capacity);
    setIsEditing(true);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  // Editing mode: show form inside card
  if (isEditing) {
    return (
      <Card
        className="overflow-hidden border-primary ring-2 ring-primary/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-row h-full">
          {/* Left 1/3 image */}
          <div className="relative w-1/3 min-h-[120px] bg-muted shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Anchor className="w-8 h-8 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Right 2/3 edit form */}
          <div className="flex-1 p-3 space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Input
                  value={editVesselType}
                  onChange={(e) => setEditVesselType(e.target.value)}
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="w-16">
                <Label className="text-xs text-muted-foreground">Cap.</Label>
                <Input
                  type="number"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={isSaving}>
                <Save className="w-3 h-3 mr-1" />
                {isSaving ? '...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={cancelEdit}>
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`
        overflow-hidden cursor-pointer transition-all duration-300 group relative
        ${isSelected
          ? 'ring-2 ring-primary shadow-lg'
          : 'hover:shadow-md border-border/50'
        }
      `}
      onClick={onClick}
    >
      {/* Admin action buttons */}
      {isAdmin && (
        <div className="absolute top-1.5 right-1.5 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={startEdit}
            title="Edit yacht"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => e.stopPropagation()}
                title="Delete yacht"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this yacht and all its images from the system. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Horizontal layout: 1/3 image + 2/3 info */}
      <div className="flex flex-row h-full">
        {/* Left 1/3 - Image */}
        <div className={`relative overflow-hidden bg-muted shrink-0 ${compact ? 'w-1/3 min-h-[100px]' : 'w-1/3 min-h-[140px]'}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Anchor className={`text-muted-foreground/30 ${compact ? 'w-8 h-8' : 'w-10 h-10'}`} />
            </div>
          )}
          {isFlagship && (
            <Badge className={`absolute top-1.5 left-1.5 bg-gold text-primary-foreground border-0 gap-0.5 ${compact ? 'text-[10px] px-1 py-0' : 'text-xs px-1.5 py-0.5'}`}>
              <Star className={`fill-current ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
              {!compact && 'Flagship'}
            </Badge>
          )}
        </div>

        {/* Right 2/3 - Info */}
        <div className={`flex-1 flex flex-col justify-center ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <h3 className={`font-semibold text-foreground leading-tight truncate ${compact ? 'text-base' : 'text-lg'}`}>
            {name}
          </h3>
          <p className={`text-muted-foreground mt-0.5 truncate ${compact ? 'text-sm' : 'text-base'}`}>
            {vesselType}
          </p>
          <div className={`flex items-center gap-1.5 text-foreground/80 mt-1 ${compact ? 'text-sm' : 'text-base'}`}>
            <Users className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span>{capacity} guests</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
