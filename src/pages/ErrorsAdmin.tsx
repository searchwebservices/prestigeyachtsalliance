import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';

interface ClientError {
  id: string;
  created_at: string;
  user_id: string | null;
  session_id: string | null;
  source: string;
  severity: string;
  message: string;
  stack: string | null;
  component_stack: string | null;
  url: string | null;
  route: string | null;
  user_agent: string | null;
  viewport: string | null;
  referrer: string | null;
  release: string | null;
  metadata: Record<string, unknown> | null;
}

const SOURCES = ['all', 'react', 'window_error', 'unhandled_rejection', 'console_error', 'toast_error', 'manual'];

export default function ErrorsAdmin() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [errors, setErrors] = useState<ClientError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [routeFilter, setRouteFilter] = useState<string>('');
  const [selected, setSelected] = useState<ClientError | null>(null);

  const fetchErrors = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('client_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (sourceFilter !== 'all') q = q.eq('source', sourceFilter);
      if (routeFilter.trim()) q = q.ilike('route', `%${routeFilter.trim()}%`);

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      setErrors((data || []) as unknown as ClientError[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) fetchErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin, sourceFilter]);

  if (!authLoading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const sourceColor = (s: string) => {
    switch (s) {
      case 'react': return 'destructive';
      case 'window_error': return 'destructive';
      case 'unhandled_rejection': return 'destructive';
      case 'console_error': return 'secondary';
      case 'toast_error': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Client Errors</h1>
            <p className="text-sm text-muted-foreground">Latest 200 reported errors across all sessions.</p>
          </div>
          <Button onClick={fetchErrors} variant="outline" size="sm">Refresh</Button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Source</label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Route contains</label>
            <Input
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchErrors()}
              placeholder="/dashboard"
              className="w-64"
            />
          </div>
          <Button onClick={fetchErrors} size="sm">Apply</Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : errors.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No errors recorded.</div>
        ) : (
          <div className="border rounded-md divide-y">
            {errors.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Badge variant={sourceColor(e.source) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                    {e.source}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{e.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      <span>{new Date(e.created_at).toLocaleString()}</span>
                      {e.route && <span>route: {e.route}</span>}
                      {e.user_id && <span>user: {e.user_id.slice(0, 8)}</span>}
                      {e.viewport && <span>{e.viewport}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="break-words">{selected.message}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><span className="text-muted-foreground">Source:</span> {selected.source}</div>
                    <div><span className="text-muted-foreground">Severity:</span> {selected.severity}</div>
                    <div><span className="text-muted-foreground">Time:</span> {new Date(selected.created_at).toLocaleString()}</div>
                    <div><span className="text-muted-foreground">Session:</span> {selected.session_id}</div>
                    <div><span className="text-muted-foreground">User:</span> {selected.user_id || '(anonymous)'}</div>
                    <div><span className="text-muted-foreground">Release:</span> {selected.release}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">URL:</span> {selected.url}</div>
                    <div><span className="text-muted-foreground">Viewport:</span> {selected.viewport}</div>
                    <div><span className="text-muted-foreground">Referrer:</span> {selected.referrer || '—'}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">User agent:</span> {selected.user_agent}</div>
                  </div>

                  {selected.stack && (
                    <div>
                      <div className="text-xs font-medium mb-1">Stack</div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{selected.stack}</pre>
                    </div>
                  )}
                  {selected.component_stack && (
                    <div>
                      <div className="text-xs font-medium mb-1">Component stack</div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{selected.component_stack}</pre>
                    </div>
                  )}
                  {selected.metadata && (
                    <div>
                      <div className="text-xs font-medium mb-1">Metadata</div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selected.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
