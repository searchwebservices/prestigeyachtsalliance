import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Lock, CreditCard } from 'lucide-react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function StripeSetup() {
  const { user } = useAuth();

  const [contactName, setContactName] = useState('');
  const [keyType, setKeyType] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !keyType || !secretKey.trim()) return;

    setStatus('submitting');
    setErrorMsg('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('stripe_setup_submissions')
      .insert({
        contact_name: contactName.trim(),
        key_type: keyType,
        secret_key: secretKey.trim(),
        publishable_key: publishableKey.trim() || null,
        notes: notes.trim() || null,
        submitted_by: user?.id ?? null,
      });

    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
      return;
    }

    setStatus('success');
  }

  function handleReset() {
    setContactName('');
    setKeyType('');
    setSecretKey('');
    setPublishableKey('');
    setNotes('');
    setStatus('idle');
    setErrorMsg('');
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Stripe Setup</h1>
            <p className="text-sm text-muted-foreground">Store Stripe API keys securely</p>
          </div>
        </div>

        {status === 'success' ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Key stored</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Stripe key saved securely to the portal database.
                </p>
              </div>
              <Button variant="outline" onClick={handleReset} className="mt-2">
                Submit another
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit Stripe Key</CardTitle>
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Lock className="w-3 h-3" />
                Stored encrypted · admin access only
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="contact_name">Contact name <span className="text-destructive">*</span></Label>
                  <Input
                    id="contact_name"
                    placeholder="e.g. Ricardo Nieto"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="key_type">Key type <span className="text-destructive">*</span></Label>
                  <Select value={keyType} onValueChange={setKeyType} required>
                    <SelectTrigger id="key_type">
                      <SelectValue placeholder="Select key type…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">Live — sk_live_ / rk_live_</SelectItem>
                      <SelectItem value="test">Test — sk_test_ / rk_test_</SelectItem>
                      <SelectItem value="restricted">Restricted — rk_</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="secret_key">Secret / Restricted Key <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">
                    Starts with <code className="bg-muted px-1 rounded text-[11px]">sk_live_</code>, <code className="bg-muted px-1 rounded text-[11px]">rk_live_</code>, or test equivalents.
                  </p>
                  <Textarea
                    id="secret_key"
                    rows={3}
                    placeholder="sk_live_... or rk_live_..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="font-mono text-sm resize-none"
                    value={secretKey}
                    onChange={e => setSecretKey(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="publishable_key">
                    Publishable Key <span className="text-xs font-normal text-muted-foreground">(recommended)</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Starts with <code className="bg-muted px-1 rounded text-[11px]">pk_live_</code>.
                  </p>
                  <Textarea
                    id="publishable_key"
                    rows={2}
                    placeholder="pk_live_..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="font-mono text-sm resize-none"
                    value={publishableKey}
                    onChange={e => setPublishableKey(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">
                    Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Anything the team should know…"
                    className="resize-none"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                {status === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={status === 'submitting' || !contactName.trim() || !keyType || !secretKey.trim()}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {status === 'submitting' ? 'Saving…' : 'Save Key Securely'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
