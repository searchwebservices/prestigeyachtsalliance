import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';

interface Listing {
  id: string;
  yacht_id: string;
  listing_slug: string;
  title: string | null;
  show_description: boolean;
  show_pricing: boolean;
  is_published: boolean;
  created_at: string;
}

interface YachtListingsTabProps {
  yachtId: string;
  yachtSlug: string;
  yachtName: string;
}

const origin = window.location.origin;
const publicUrl = (slug: string) => `${origin}/y/${slug}`;

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

export default function YachtListingsTab({ yachtId, yachtSlug, yachtName }: YachtListingsTabProps) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Draft state for create / edit
  const emptyDraft = () => ({
    title: '',
    listing_slug: `${yachtSlug}-${randomSuffix()}`,
    show_description: true,
    show_pricing: true,
  });
  const [draft, setDraft] = useState(emptyDraft());

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['yacht_listings', yachtId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yacht_listings')
        .select('*')
        .eq('yacht_id', yachtId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['yacht_listings', yachtId] });

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!draft.listing_slug.trim()) {
      toast.error('Slug is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('yacht_listings').insert({
      yacht_id: yachtId,
      listing_slug: draft.listing_slug.trim().toLowerCase().replace(/\s+/g, '-'),
      title: draft.title.trim() || null,
      show_description: draft.show_description,
      show_pricing: draft.show_pricing,
      is_published: false,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to create listing', { description: error.message });
      return;
    }
    toast.success('Listing created', { description: 'Toggle Published when ready to go live.' });
    setCreating(false);
    setDraft(emptyDraft());
    invalidate();
  };

  // ── Edit ─────────────────────────────────────────────────────────────────

  const startEdit = (l: Listing) => {
    setDraft({ title: l.title ?? '', listing_slug: l.listing_slug, show_description: l.show_description, show_pricing: l.show_pricing });
    setEditingId(l.id);
    setCreating(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!draft.listing_slug.trim()) { toast.error('Slug is required'); return; }
    setSaving(true);
    const { error } = await supabase.from('yacht_listings').update({
      listing_slug: draft.listing_slug.trim().toLowerCase().replace(/\s+/g, '-'),
      title: draft.title.trim() || null,
      show_description: draft.show_description,
      show_pricing: draft.show_pricing,
    }).eq('id', id);
    setSaving(false);
    if (error) { toast.error('Failed to save', { description: error.message }); return; }
    toast.success('Listing updated');
    setEditingId(null);
    invalidate();
  };

  // ── Publish toggle ────────────────────────────────────────────────────────

  const togglePublished = async (l: Listing) => {
    const { error } = await supabase
      .from('yacht_listings')
      .update({ is_published: !l.is_published })
      .eq('id', l.id);
    if (error) { toast.error('Failed to update', { description: error.message }); return; }
    toast.success(l.is_published ? 'Listing unpublished' : 'Listing published — link is now live');
    invalidate();
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('yacht_listings').delete().eq('id', deleteId);
    if (error) { toast.error('Failed to delete', { description: error.message }); }
    else { toast.success('Listing deleted'); }
    setDeleteId(null);
    invalidate();
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(publicUrl(slug));
    toast.success('Link copied');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Create shareable public pages for <span className="font-medium text-foreground">{yachtName}</span>. Each listing has its own URL and content toggles.
          </p>
        </div>
        {!creating && !editingId && (
          <Button size="sm" onClick={() => { setDraft(emptyDraft()); setCreating(true); setEditingId(null); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Listing
          </Button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Listing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DraftForm draft={draft} onChange={setDraft} origin={origin} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listings list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading listings…
        </div>
      ) : listings.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <Globe className="w-8 h-8 mb-3 opacity-30" />
          <p className="text-sm font-medium">No public listings yet</p>
          <p className="text-xs mt-1">Create one to generate a shareable link</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <Card key={l.id} className={`border-border/60 transition-colors ${l.is_published ? 'border-success/40 bg-success/5' : ''}`}>
              {editingId === l.id ? (
                <CardContent className="pt-4 space-y-4">
                  <DraftForm draft={draft} onChange={setDraft} origin={origin} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      <X className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(l.id)} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {l.is_published ? (
                          <Badge className="bg-success/15 text-success border-0 text-xs">Live</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Draft</Badge>
                        )}
                        {l.title && <span className="text-sm font-medium text-foreground">{l.title}</span>}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">{publicUrl(l.listing_slug)}</p>
                      <div className="flex gap-3 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {l.show_description ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          Description
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {l.show_pricing ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          Pricing
                        </span>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      {/* Published toggle */}
                      <div className="flex items-center gap-1.5 border border-border/60 rounded-md px-2 py-1">
                        <Switch
                          checked={l.is_published}
                          onCheckedChange={() => togglePublished(l)}
                          className="scale-90"
                        />
                        <span className="text-xs text-muted-foreground">{l.is_published ? 'Live' : 'Draft'}</span>
                      </div>

                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyLink(l.listing_slug)} title="Copy link">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Preview">
                        <a href={`/y/${l.listing_slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(l)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(l.id)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the public page permanently. Any shared links will stop working.
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

// ── Shared draft form ─────────────────────────────────────────────────────────

interface DraftState {
  title: string;
  listing_slug: string;
  show_description: boolean;
  show_pricing: boolean;
}

function DraftForm({ draft, onChange, origin }: { draft: DraftState; onChange: (d: DraftState) => void; origin: string }) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Listing Title <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            placeholder={`e.g. Summer Special`}
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL Slug</Label>
          <Input
            placeholder="ocean-breeze-summer"
            value={draft.listing_slug}
            onChange={(e) => onChange({ ...draft, listing_slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
          />
          <p className="text-[10px] text-muted-foreground truncate">{origin}/y/{draft.listing_slug || '…'}</p>
        </div>
      </div>
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.show_description}
            onCheckedChange={(v) => onChange({ ...draft, show_description: v })}
          />
          <Label className="text-sm cursor-pointer">Show description</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.show_pricing}
            onCheckedChange={(v) => onChange({ ...draft, show_pricing: v })}
          />
          <Label className="text-sm cursor-pointer">Show pricing &amp; payment links</Label>
        </div>
      </div>
    </div>
  );
}
