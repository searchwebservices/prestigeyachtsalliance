import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ExternalLink, DollarSign } from 'lucide-react';

interface PaymentLink {
  id: string;
  yacht_id: string;
  duration_hours: number;
  label: string | null;
  amount_usd: number | null;
  stripe_url: string;
  sort_order: number;
}

interface Props {
  yachtId: string;
}

const emptyDraft = { duration_hours: 4, label: '', amount_usd: '', stripe_url: '' };

export default function PaymentLinksManager({ yachtId }: Props) {
  const { isAdmin } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('yacht_payment_links')
      .select('*')
      .eq('yacht_id', yachtId)
      .order('duration_hours', { ascending: true });
    if (error) {
      toast.error('Failed to load payment links');
    } else {
      setLinks((data ?? []) as PaymentLink[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yachtId]);

  const handleAdd = async () => {
    if (!draft.stripe_url.trim()) {
      toast.error('Stripe URL is required');
      return;
    }
    const hours = Number(draft.duration_hours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
      toast.error('Duration must be between 1 and 24 hours');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('yacht_payment_links').insert({
      yacht_id: yachtId,
      duration_hours: hours,
      label: draft.label.trim() || null,
      amount_usd: draft.amount_usd ? Number(draft.amount_usd) : null,
      stripe_url: draft.stripe_url.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === '23505'
          ? `A link already exists for ${hours}h on this yacht`
          : 'Failed to add link'
      );
      return;
    }
    setDraft(emptyDraft);
    toast.success('Payment link added');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment link?')) return;
    const { error } = await supabase.from('yacht_payment_links').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Deleted');
    load();
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 p-4 md:p-6 md:pb-3">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
          Payment links
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Stripe payment links for specific charter durations. Used on the Deposit page.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No duration-specific links yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
              >
                <div className="font-mono text-sm font-semibold w-12 shrink-0">
                  {link.duration_hours}h
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {link.label || 'Charter payment'}
                    {link.amount_usd != null && (
                      <span className="ml-2 text-muted-foreground">
                        ${Number(link.amount_usd).toLocaleString()} USD
                      </span>
                    )}
                  </div>
                  <a
                    href={link.stripe_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{link.stripe_url}</span>
                  </a>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(link.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-sm font-medium">Add a new link</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Hours</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={draft.duration_hours}
                  onChange={(e) =>
                    setDraft({ ...draft, duration_hours: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Amount (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="optional"
                  value={draft.amount_usd}
                  onChange={(e) => setDraft({ ...draft, amount_usd: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Label</Label>
                <Input
                  placeholder="optional, e.g. 4h charter"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                />
              </div>
              <div className="col-span-2 md:col-span-4">
                <Label className="text-xs">Stripe URL *</Label>
                <Input
                  placeholder="https://buy.stripe.com/..."
                  value={draft.stripe_url}
                  onChange={(e) => setDraft({ ...draft, stripe_url: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {saving ? 'Adding…' : 'Add link'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
