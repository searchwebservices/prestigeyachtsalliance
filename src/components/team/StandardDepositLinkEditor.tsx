import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

const KEY = 'standard_deposit_stripe_url';

export default function StandardDepositLinkEditor() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', KEY)
        .maybeSingle();
      setValue(data?.value ?? '');
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error('URL is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY, value: value.trim() }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    toast.success('Standard deposit link updated');
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg">Standard deposit link</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          The default $500 USD Stripe link used on the Deposit page when no yacht-specific
          option is selected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Stripe URL</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://buy.stripe.com/..."
            disabled={loading}
          />
        </div>
        <Button onClick={handleSave} disabled={loading || saving} size="sm" className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}
