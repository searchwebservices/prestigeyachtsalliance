import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import InvoiceDetailSheet, { type InvoiceRow } from '@/components/invoices/InvoiceDetailSheet';

type Invoice = InvoiceRow;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  paid: 'bg-success/15 text-success',
  void: 'bg-destructive/15 text-destructive',
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export default function Invoices() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(today));
  const [selectedYacht, setSelectedYacht] = useState<string>('all');
  const [sheetInvoice, setSheetInvoice] = useState<Invoice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', format(monthStart, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gte('trip_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('trip_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('trip_date', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const yachtOptions = useMemo(() => {
    const names = [...new Set(invoices.map((i) => i.yacht_name))].sort();
    return names;
  }, [invoices]);

  const filtered = useMemo(() => {
    if (selectedYacht === 'all') return invoices;
    return invoices.filter((i) => i.yacht_name === selectedYacht);
  }, [invoices, selectedYacht]);

  const totalRevenue = filtered.reduce((sum, i) => sum + (i.subtotal_usd ?? i.duration_hours * i.hourly_rate_usd), 0);
  const paidRevenue = filtered
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + (i.subtotal_usd ?? i.duration_hours * i.hourly_rate_usd), 0);

  const prevMonth = () => setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    if (next <= today) setSelectedMonth(next);
  };

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['Invoice #', 'Yacht', 'Guest', 'Email', 'Trip Date', 'Hours', 'Rate/hr', 'Total', 'Status'];
    const rows = filtered.map((i) => [
      i.invoice_number ?? '',
      i.yacht_name,
      i.guest_name ?? '',
      i.guest_email ?? '',
      i.trip_date,
      i.duration_hours.toString(),
      fmt.format(i.hourly_rate_usd),
      fmt.format(i.subtotal_usd ?? i.duration_hours * i.hourly_rate_usd),
      i.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${format(selectedMonth, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
              <p className="text-sm text-muted-foreground">Trip invoices by vessel and month</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month navigator */}
          <div className="flex items-center gap-1 border border-border rounded-md">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-r-none" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 text-sm font-medium min-w-[110px] text-center">
              {format(selectedMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={nextMonth}
              disabled={new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1) > today}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Yacht filter */}
          <Select value={selectedYacht} onValueChange={setSelectedYacht}>
            <SelectTrigger className="w-48 h-9">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All yachts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All yachts</SelectItem>
              {yachtOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoices</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Billed</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold">{fmt.format(totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collected</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold text-success">{fmt.format(paidRevenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold text-gold">{fmt.format(totalRevenue - paidRevenue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Table */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Loading invoices…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No invoices for {format(selectedMonth, 'MMMM yyyy')}</p>
                {selectedYacht !== 'all' && (
                  <p className="text-xs mt-1">Try clearing the yacht filter</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="pl-6">Invoice #</TableHead>
                      <TableHead>Yacht</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Trip Date</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate/hr</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((invoice) => {
                      const total = invoice.subtotal_usd ?? invoice.duration_hours * invoice.hourly_rate_usd;
                      return (
                        <TableRow
                          key={invoice.id}
                          className="border-border/50 cursor-pointer hover:bg-muted/40"
                          onClick={() => { setSheetInvoice(invoice); setSheetOpen(true); }}
                        >
                          <TableCell className="pl-6 font-mono text-sm font-medium">
                            {invoice.invoice_number ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm">{invoice.yacht_name}</TableCell>
                          <TableCell className="text-sm">
                            <div>{invoice.guest_name ?? '—'}</div>
                            {invoice.guest_email && (
                              <div className="text-xs text-muted-foreground">{invoice.guest_email}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(invoice.trip_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right text-sm">{invoice.duration_hours}h</TableCell>
                          <TableCell className="text-right text-sm">{fmt.format(invoice.hourly_rate_usd)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{fmt.format(total)}</TableCell>
                          <TableCell className="pr-6">
                            <Badge
                              className={`text-xs capitalize border-0 ${STATUS_COLORS[invoice.status] ?? 'bg-muted text-muted-foreground'}`}
                            >
                              {invoice.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <InvoiceDetailSheet
        invoice={sheetInvoice}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </DashboardLayout>
  );
}
