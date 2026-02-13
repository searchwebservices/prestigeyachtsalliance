import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CalendarClock,
  Copy,
  Download,
  Eye,
  FileText,
  Shield,
  User,
  Upload,
  Save,
  X,
  ExternalLink,
  RefreshCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { TeamReservationOversightItem } from '@/components/admin-calendar/types';

interface TeamUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  activity_count: number;
  page_loads: number;
  copy_events: number;
  yacht_views: number;
  trips_booked: number;
}

interface ActivityItem {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

interface UserDetailsDialogProps {
  user: TeamUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdate?: () => void;
}

type OversightResponse = {
  records?: unknown;
  items?: unknown;
  error?: string;
};

const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => asString(item)).filter((item): item is string => item !== null) : [];

const normalizeOversight = (value: unknown): TeamReservationOversightItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): TeamReservationOversightItem | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;

      const bookingUid =
        asString(row.bookingUid) ||
        asString(row.booking_uid) ||
        asString(row.uid) ||
        '';
      if (!bookingUid) return null;

      return {
        reservationId: asString(row.reservationId ?? row.reservation_id),
        bookingUid,
        yachtSlug: asString(row.yachtSlug ?? row.yacht_slug) || '',
        yachtName: asString(row.yachtName ?? row.yacht_name) || '',
        startAt: asString(row.startAt ?? row.start_at) || '',
        endAt: asString(row.endAt ?? row.end_at) || '',
        status: asString(row.status) || 'booked',
        guestName: asString(row.guestName ?? row.guest_name) || '',
        completionScore: asNumber(row.completionScore ?? row.completion_score),
        missingFields: asStringArray(row.missingFields ?? row.missing_fields),
        lastAction: asString(row.lastAction ?? row.last_action),
        lastActionAt: asString(row.lastActionAt ?? row.last_action_at),
        lastUpdatedAt: asString(row.lastUpdatedAt ?? row.last_updated_at),
      };
    })
    .filter((item): item is TeamReservationOversightItem => item !== null);
};

const getDateInput = (date: Date) => format(date, 'yyyy-MM-dd');

export function UserDetailsDialog({ user, open, onOpenChange, onUserUpdate }: UserDetailsDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [oversightItems, setOversightItems] = useState<TeamReservationOversightItem[]>([]);
  const [oversightLoading, setOversightLoading] = useState(false);
  const [oversightError, setOversightError] = useState<string | null>(null);
  const [oversightFrom, setOversightFrom] = useState(getDateInput(subDays(new Date(), 30)));
  const [oversightTo, setOversightTo] = useState(getDateInput(new Date()));
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return null;
    return {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const fetchUserActivity = useCallback(async (userId: string) => {
    setActivityLoading(true);
    try {
      const response = await supabase.functions.invoke('get-user-activity', {
        body: { userId },
      });

      if (response.error) {
        console.error('Failed to fetch activity:', response.error);
        setActivities([]);
      } else {
        setActivities(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const fetchOversight = useCallback(async (userId: string, from: string, to: string) => {
    setOversightLoading(true);
    setOversightError(null);

    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setOversightError('Session expired. Please sign in again.');
        setOversightItems([]);
        return;
      }

      const response = await fetch(
        `${apiBase}/internal-team-member-reservation-oversight?userId=${encodeURIComponent(userId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        {
          method: 'GET',
          headers,
        }
      );

      const payload = (await response.json().catch(() => ({}))) as OversightResponse;

      if (!response.ok) {
        if (response.status === 401) {
          setOversightError('Session expired. Please sign in again.');
        } else if (response.status === 403) {
          setOversightError('Admin access required to view reservation oversight.');
        } else if (response.status === 404 || response.status === 405 || response.status === 501) {
          setOversightError('Oversight endpoint is not deployed yet.');
        } else {
          setOversightError(payload.error || 'Unable to load reservation oversight.');
        }
        setOversightItems([]);
        return;
      }

      const data = payload.records ?? payload.items ?? payload;
      setOversightItems(normalizeOversight(data));
    } catch (error) {
      console.error('Error loading oversight:', error);
      setOversightError(error instanceof Error ? error.message : 'Unable to load reservation oversight.');
      setOversightItems([]);
    } finally {
      setOversightLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!user || !open) return;

    setEditName(user.full_name || '');
    setIsEditing(false);
    setActiveTab('overview');
    void fetchUserActivity(user.id);
    void fetchOversight(user.id, oversightFrom, oversightTo);
  }, [fetchOversight, fetchUserActivity, open, oversightFrom, oversightTo, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const response = await supabase.functions.invoke('update-user-profile', {
        body: { userId: user.id, full_name: editName.trim() || null },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update profile');
      }

      toast({
        title: 'Profile updated',
        description: 'Team member profile has been updated.',
      });
      setIsEditing(false);
      onUserUpdate?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please select an image file.',
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const response = await supabase.functions.invoke('update-user-profile', {
        body: { userId: user.id, avatar_url: avatarUrl },
      });
      if (response.error) {
        throw new Error(response.error.message || 'Failed to update avatar');
      }

      toast({
        title: 'Avatar updated',
        description: 'Profile picture has been updated.',
      });
      onUserUpdate?.();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Failed to upload avatar.',
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopyStats = async () => {
    if (!user) return;

    const text = `Team Member: ${user.full_name || user.email}
Email: ${user.email}
Role: ${user.role}
Member Since: ${format(new Date(user.created_at), 'MMM d, yyyy')}
Last Active: ${user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy HH:mm') : 'Never'}
Trips Booked: ${user.trips_booked}
Total Activity: ${user.activity_count}`;

    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Team member summary copied to clipboard.',
    });
  };

  const handleExportActivity = () => {
    if (!user || activities.length === 0) return;

    const headers = ['Event Type', 'Details', 'Timestamp'];
    const rows = activities.map((activity) => [
      activity.event_type,
      JSON.stringify(activity.event_data),
      format(new Date(activity.created_at), 'yyyy-MM-dd HH:mm:ss'),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `activity-${user.email.split('@')[0]}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const filteredOversight = useMemo(() => {
    const statusFiltered = oversightItems.filter((item) => {
      if (!incompleteOnly) return true;
      return (item.completionScore ?? 0) < 100;
    });
    return statusFiltered.sort((a, b) => {
      const aDate = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bDate = b.startAt ? new Date(b.startAt).getTime() : 0;
      return bDate - aDate;
    });
  }, [incompleteOnly, oversightItems]);

  const oversightSummary = useMemo(() => {
    if (filteredOversight.length === 0) {
      return {
        total: 0,
        incomplete: 0,
        avgCompletion: 0,
      };
    }

    const incomplete = filteredOversight.filter((item) => (item.completionScore ?? 0) < 100).length;
    const avgCompletion = Math.round(
      filteredOversight.reduce((sum, item) => sum + (item.completionScore ?? 0), 0) / filteredOversight.length
    );
    return {
      total: filteredOversight.length,
      incomplete,
      avgCompletion,
    };
  }, [filteredOversight]);

  const getUserInitials = (teamUser: TeamUser) => {
    if (teamUser.full_name) {
      return teamUser.full_name
        .split(' ')
        .map((namePart) => namePart[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return teamUser.email.substring(0, 2).toUpperCase();
  };

  const openReservation = (item: TeamReservationOversightItem) => {
    const dateKey = item.startAt ? item.startAt.slice(0, 10) : '';
    const query = new URLSearchParams({
      slug: item.yachtSlug,
      bookingUid: item.bookingUid,
    });
    if (dateKey) query.set('date', dateKey);

    onOpenChange(false);
    navigate(`/calendar?${query.toString()}`);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'page_load':
        return <Eye className="h-3.5 w-3.5" />;
      case 'copy_text':
        return <Copy className="h-3.5 w-3.5" />;
      case 'yacht_view':
        return <Activity className="h-3.5 w-3.5" />;
      case 'trip_booked':
        return <FileText className="h-3.5 w-3.5" />;
      default:
        return <CalendarClock className="h-3.5 w-3.5" />;
    }
  };

  const getEventLabel = (eventType: string, eventData: Record<string, unknown>) => {
    switch (eventType) {
      case 'page_load':
        return `Loaded ${eventData.page || 'page'}`;
      case 'copy_text':
        return `Copied ${eventData.context || 'text'}`;
      case 'yacht_view':
        return `Viewed ${eventData.yacht_name || 'yacht'}`;
      case 'trip_booked':
        return `Booked ${eventData.yacht_name || 'trip'} for ${eventData.customer_name || 'client'}`;
      default:
        return eventType;
    }
  };

  if (!user) return null;

  const userInitials = getUserInitials(user);
  const isAdmin = user.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 bg-card px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Team Member Control Center</DialogTitle>
              <DialogDescription>
                Profile, reservation oversight, and activity quality in one place.
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyStats}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Summary
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="border-b border-border/70 px-6 py-3">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="oversight">Reservation Oversight</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(92vh-170px)]">
            <TabsContent value="overview" className="mt-0 space-y-5 px-6 py-5">
              <Card className="border-border/70">
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 border-2 border-border">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {uploadingAvatar ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Upload className="h-5 w-5 text-white" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="flex-1 space-y-3">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                            <Save className="mr-1 h-3.5 w-3.5" />
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                            <X className="mr-1 h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold text-foreground">{user.full_name || 'No name set'}</h3>
                          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                            Edit
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <Badge variant={isAdmin ? 'default' : 'secondary'}>
                          {isAdmin ? (
                            <>
                              <Shield className="mr-1 h-3 w-3" />
                              Admin
                            </>
                          ) : (
                            <>
                              <User className="mr-1 h-3 w-3" />
                              Staff
                            </>
                          )}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">Trips Booked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{user.trips_booked}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{user.activity_count}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">Page Loads</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{user.page_loads}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">Copy Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{user.copy_events}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground">Yacht Views</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{user.yacht_views}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
                  <p>
                    Member since <span className="font-medium text-foreground">{format(new Date(user.created_at), 'MMM d, yyyy')}</span>
                  </p>
                  <p>
                    Last active{' '}
                    <span className="font-medium text-foreground">
                      {user.last_sign_in_at
                        ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="oversight" className="mt-0 space-y-5 px-6 py-5">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input type="date" value={oversightFrom} onChange={(event) => setOversightFrom(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input type="date" value={oversightTo} onChange={(event) => setOversightTo(event.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Switch checked={incompleteOnly} onCheckedChange={setIncompleteOnly} />
                      <span className="text-sm text-muted-foreground">Incomplete only</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => user && void fetchOversight(user.id, oversightFrom, oversightTo)}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Reservations touched</p>
                      <p className="text-xl font-semibold">{oversightSummary.total}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Incomplete</p>
                      <p className="text-xl font-semibold">{oversightSummary.incomplete}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Avg completion</p>
                      <p className="text-xl font-semibold">{oversightSummary.avgCompletion}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {oversightError ? (
                <Card className="border-destructive/40">
                  <CardContent className="p-4 text-sm text-destructive">{oversightError}</CardContent>
                </Card>
              ) : null}

              {oversightLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking UID</TableHead>
                        <TableHead>Trip</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completion</TableHead>
                        <TableHead>Last action</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOversight.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No reservation oversight data for this range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOversight.map((item) => (
                          <TableRow key={`${item.bookingUid}-${item.startAt}`}>
                            <TableCell className="font-mono text-xs">{item.bookingUid}</TableCell>
                            <TableCell>
                              <p className="font-medium">{item.yachtName || item.yachtSlug}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.startAt ? format(new Date(item.startAt), 'MMM d, yyyy HH:mm') : '-'}
                              </p>
                            </TableCell>
                            <TableCell>{item.guestName || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="uppercase">
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{item.completionScore ?? 0}%</span>
                              {item.missingFields.length > 0 ? (
                                <p className="text-xs text-muted-foreground">{item.missingFields.slice(0, 2).join(', ')}</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <p>{item.lastAction || '-'}</p>
                              <p>{item.lastActionAt ? formatDistanceToNow(new Date(item.lastActionAt), { addSuffix: true }) : '-'}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button type="button" variant="outline" size="sm" onClick={() => openReservation(item)}>
                                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                Open reservation
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4 px-6 py-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Recent Activity</h4>
                <Button variant="outline" size="sm" onClick={handleExportActivity} disabled={activities.length === 0}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export activity
                </Button>
              </div>

              {activityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ) : activities.length === 0 ? (
                <p className="rounded-md border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 rounded-md border border-border/70 bg-card p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        {getEventIcon(activity.event_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {getEventLabel(activity.event_type, activity.event_data)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
