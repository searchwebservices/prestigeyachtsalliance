import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Upload,
  Trash2,
  Plus,
  FileDown,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  booking_uid: string;
  yacht_name: string;
  yacht_slug: string;
  guest_name: string | null;
  guest_email: string | null;
  trip_date: string;
  duration_hours: number;
  hourly_rate_usd: number;
  subtotal_usd: number | null;
  status: string;
  notes: string | null;
  payment_notes: string | null;
  factura_urls: string[];
  created_at: string | null;
};

type Payment = {
  id: string;
  invoice_id: string;
  amount_usd: number;
  paid_on: string;
  method: string | null;
  is_deposit: boolean;
  notes: string | null;
  created_at: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['draft', 'sent', 'paid', 'void'] as const;
const METHOD_OPTIONS = ['cash', 'wire', 'card', 'zelle', 'check', 'other'] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  paid: 'bg-success/15 text-success',
  void: 'bg-destructive/15 text-destructive',
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const fileNameFromPath = (path: string) => path.split('/').pop() ?? path;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  invoice: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailSheet({ invoice, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>('draft');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [facturaUrls, setFacturaUrls] = useState<string[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newMethod, setNewMethod] = useState<string>('cash');
  const [newIsDeposit, setNewIsDeposit] = useState(false);
  const [newNotes, setNewNotes] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);

  // Sync state when invoice changes
  useEffect(() => {
    if (!invoice) return;
    setStatus(invoice.status);
    setPaymentNotes(invoice.payment_notes ?? '');
    setFacturaUrls(invoice.factura_urls ?? []);
    void fetchPayments(invoice.id);
  }, [invoice?.id]);

  const fetchPayments = async (invoiceId: string) => {
    setLoadingPayments(true);
    const { data } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_on', { ascending: true });
    setPayments((data as Payment[]) ?? []);
    setLoadingPayments(false);
  };

  const invalidateInvoices = () => qc.invalidateQueries({ queryKey: ['invoices'] });

  // ── Save invoice metadata ──────────────────────────────────────────────────

  const handleSave = async () => {
    if (!invoice) return;
    setSaving(true);
    const { error } = await supabase
      .from('invoices')
      .update({ status, payment_notes: paymentNotes || null, updated_at: new Date().toISOString() })
      .eq('id', invoice.id);
    setSaving(false);
    if (error) { toast.error('Failed to save', { description: error.message }); return; }
    toast.success('Invoice saved');
    invalidateInvoices();
  };

  // ── Factura upload ────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!invoice || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    const path = `${invoice.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('facturas').upload(path, file);
    if (uploadErr) {
      toast.error('Upload failed', { description: uploadErr.message });
      setUploading(false);
      return;
    }
    const newUrls = [...facturaUrls, path];
    setFacturaUrls(newUrls);
    await supabase.from('invoices').update({ factura_urls: newUrls }).eq('id', invoice.id);
    toast.success('Factura uploaded');
    setUploading(false);
    invalidateInvoices();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (path: string) => {
    const { data, error } = await supabase.storage.from('facturas').createSignedUrl(path, 300);
    if (error || !data) { toast.error('Could not generate download link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const handleRemoveFactura = async (path: string) => {
    if (!invoice) return;
    await supabase.storage.from('facturas').remove([path]);
    const newUrls = facturaUrls.filter((u) => u !== path);
    setFacturaUrls(newUrls);
    await supabase.from('invoices').update({ factura_urls: newUrls }).eq('id', invoice.id);
    toast.success('Factura removed');
    invalidateInvoices();
  };

  // ── Add payment ───────────────────────────────────────────────────────────

  const handleAddPayment = async () => {
    if (!invoice || !newAmount.trim()) return;
    setAddingPayment(true);
    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: invoice.id,
      amount_usd: parseFloat(newAmount),
      paid_on: newDate,
      method: newMethod || null,
      is_deposit: newIsDeposit,
      notes: newNotes || null,
    });
    if (error) {
      toast.error('Failed to add payment', { description: error.message });
    } else {
      toast.success('Payment recorded');
      setNewAmount('');
      setNewNotes('');
      setNewIsDeposit(false);
      await fetchPayments(invoice.id);
      invalidateInvoices();
    }
    setAddingPayment(false);
  };

  const handleDeletePayment = async (id: string) => {
    if (!invoice) return;
    const { error } = await supabase.from('invoice_payments').delete().eq('id', id);
    if (error) { toast.error('Failed to delete payment'); return; }
    await fetchPayments(invoice.id);
    invalidateInvoices();
  };

  // ── Derived values ────────────────────────────────────────────────────────

  if (!invoice) return null;

  const total = invoice.subtotal_usd ?? invoice.duration_hours * invoice.hourly_rate_usd;
  const collected = payments.reduce((sum, p) => sum + p.amount_usd, 0);
  const balance = total - collected;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base">
                {invoice.invoice_number ?? 'Invoice'}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {invoice.yacht_name} · {format(parseISO(invoice.trip_date), 'MMM d, yyyy')}
              </SheetDescription>
            </div>
            <Badge className={`text-xs capitalize border-0 ${STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft}`}>
              {invoice.status}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6">

          {/* Billing summary */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{invoice.duration_hours}h × {fmt.format(invoice.hourly_rate_usd)}/hr</span>
              <span className="font-semibold">{fmt.format(total)}</span>
            </div>
            {invoice.guest_name && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Guest</span>
                <span>{invoice.guest_name}{invoice.guest_email ? ` · ${invoice.guest_email}` : ''}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Collected</span>
              <span className="text-success font-medium">{fmt.format(collected)}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span>Balance due</span>
              <span className={balance > 0 ? 'text-destructive' : 'text-success'}>{fmt.format(balance)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Notes</Label>
            <Textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Internal notes on payment arrangements…"
              rows={2}
            />
          </div>

          <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>

          <Separator />

          {/* Payments */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Payments
            </h3>

            {loadingPayments ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{fmt.format(p.amount_usd)}</span>
                        {p.is_deposit && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deposit</Badge>
                        )}
                        {p.method && (
                          <span className="text-xs text-muted-foreground capitalize">{p.method}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(p.paid_on), 'MMM d, yyyy')}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeletePayment(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add payment form */}
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record Payment</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Amount (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Method</Label>
                  <Select value={newMethod} onValueChange={setNewMethod}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    placeholder="Optional"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newIsDeposit}
                    onCheckedChange={setNewIsDeposit}
                    className="scale-90"
                  />
                  <Label className="text-xs cursor-pointer">Mark as deposit</Label>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddPayment}
                  disabled={!newAmount || addingPayment}
                  className="h-8"
                >
                  {addingPayment ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                  Add
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Facturas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Facturas</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xml,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            {facturaUrls.length === 0 ? (
              <p className="text-xs text-muted-foreground">No facturas uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {facturaUrls.map((path) => (
                  <div key={path} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                    <p className="text-xs text-foreground truncate min-w-0">{fileNameFromPath(path)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => void handleDownload(path)}
                        title="Download"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleRemoveFactura(path)}
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
