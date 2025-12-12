import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const yachtSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  vessel_type: z.string().min(1, 'Vessel type is required').max(100),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1'),
  is_flagship: z.boolean().default(false),
  team_description: z.string().optional(),
  sales_description: z.string().optional(),
  public_price: z.coerce.number().optional(),
  commission_amount: z.coerce.number().optional(),
  owner_notes: z.string().optional(),
  cal_embed_url: z.string().url().optional().or(z.literal('')),
});

type YachtFormData = z.infer<typeof yachtSchema>;

interface AddYachtDialogProps {
  onSuccess: () => void;
}

export default function AddYachtDialog({ onSuccess }: AddYachtDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<YachtFormData>({
    resolver: zodResolver(yachtSchema),
    defaultValues: {
      name: '',
      vessel_type: '',
      capacity: 0,
      is_flagship: false,
      team_description: '',
      sales_description: '',
      public_price: undefined,
      commission_amount: undefined,
      owner_notes: '',
      cal_embed_url: '',
    },
  });

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const onSubmit = async (data: YachtFormData) => {
    setIsSubmitting(true);
    try {
      const slug = generateSlug(data.name);
      
      const { error } = await supabase.from('yachts').insert({
        name: data.name,
        slug,
        vessel_type: data.vessel_type,
        capacity: data.capacity,
        is_flagship: data.is_flagship,
        team_description: data.team_description || null,
        sales_description: data.sales_description || null,
        public_price: data.public_price || null,
        commission_amount: data.commission_amount || null,
        owner_notes: data.owner_notes || null,
        cal_embed_url: data.cal_embed_url || null,
      });

      if (error) throw error;

      toast.success('Yacht added successfully');
      form.reset();
      setOpen(false);
      onSuccess();
    } catch (err) {
      console.error('Error adding yacht:', err);
      toast.error('Failed to add yacht');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Yacht
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Yacht</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ocean Breeze" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vessel_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel Type *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Catamaran" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="public_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Price (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commission_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="team_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Internal notes for the team..." 
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sales_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Marketing copy for prospects..." 
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="owner_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Private owner notes..." 
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cal_embed_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cal.com Embed URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://cal.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_flagship"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Mark as flagship vessel
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Yacht'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
