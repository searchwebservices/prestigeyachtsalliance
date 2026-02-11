import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  User, 
  Eye, 
  Copy,
  Clock,
  Calendar,
  Activity,
  Pencil,
  Save,
  X,
  Upload,
  Download,
  FileText
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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

export function UserDetailsDialog({ user, open, onOpenChange, onUserUpdate }: UserDetailsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchUserActivity();
      setEditName(user.full_name || '');
      setIsEditing(false);
    }
  }, [user, open]);

  const fetchUserActivity = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('get-user-activity', {
        body: { userId: user.id },
      });

      if (response.error) {
        console.error('Failed to fetch activity:', response.error);
      } else {
        setActivities(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err) {
      console.error('Error updating profile:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
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

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting query param
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
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Failed to upload avatar.',
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopyStats = async () => {
    if (!user) return;
    const text = `Team Member: ${user.full_name || user.email}
Email: ${user.email}
Role: ${user.role}
Member Since: ${format(new Date(user.created_at), 'MMM d, yyyy')}
Last Active: ${user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy HH:mm') : 'Never'}
Page Loads: ${user.page_loads}
Copy Events: ${user.copy_events}
Yacht Views: ${user.yacht_views}
Trips Booked: ${user.trips_booked}
Total Activity: ${user.activity_count}`;

    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'User stats copied to clipboard.',
    });
  };

  const handleExportActivity = () => {
    if (!user || activities.length === 0) return;

    const headers = ['Event Type', 'Details', 'Timestamp'];
    const rows = activities.map(a => [
      a.event_type,
      JSON.stringify(a.event_data),
      format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `activity-${user.email.split('@')[0]}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: 'Exported!',
      description: 'Activity log exported as CSV.',
    });
  };

  if (!user) return null;

  const userInitials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email.substring(0, 2).toUpperCase();

  const isAdmin = user.role === 'admin';

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'page_load':
        return <Eye className="w-3.5 h-3.5" />;
      case 'copy_text':
        return <Copy className="w-3.5 h-3.5" />;
      case 'yacht_view':
        return <Activity className="w-3.5 h-3.5" />;
      case 'trip_booked':
        return <FileText className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
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

  const getEventSecondaryLabel = (eventType: string, eventData: Record<string, unknown>) => {
    if (eventType !== 'trip_booked') return null;

    const bookingId =
      (typeof eventData.booking_transaction_id === 'string' && eventData.booking_transaction_id) ||
      (typeof eventData.booking_uid === 'string' && eventData.booking_uid) ||
      'N/A';
    const tripDate = typeof eventData.trip_date === 'string' ? eventData.trip_date : 'Unknown date';
    const tripTime = typeof eventData.trip_time_range === 'string' ? eventData.trip_time_range : 'Unknown time';
    return `Txn ${bookingId} • ${tripDate} • ${tripTime}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Team Member Details</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={handleCopyStats} title="Copy stats">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info Header */}
          <div className="flex items-start gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16 border-2 border-border">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-white" />
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
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter full name"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {user.full_name || 'No name set'}
                    </h3>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge
                    variant={isAdmin ? 'default' : 'secondary'}
                    className="mt-1"
                  >
                    {isAdmin ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Admin
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 mr-1" />
                        Staff
                      </>
                    )}
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Eye className="w-3.5 h-3.5" />
                Page Loads
              </div>
              <p className="text-2xl font-semibold text-foreground">{user.page_loads}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Copy className="w-3.5 h-3.5" />
                Copy Events
              </div>
              <p className="text-2xl font-semibold text-foreground">{user.copy_events}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Activity className="w-3.5 h-3.5" />
                Yacht Views
              </div>
              <p className="text-2xl font-semibold text-foreground">{user.yacht_views}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <FileText className="w-3.5 h-3.5" />
                Trips Booked
              </div>
              <p className="text-2xl font-semibold text-foreground">{user.trips_booked}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" />
                Member Since
              </div>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(user.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Last Active */}
          {user.last_sign_in_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last active {formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}
            </div>
          )}

          {/* Activity Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Recent Activity</h4>
              {activities.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleExportActivity}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Export
                </Button>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activity recorded yet
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {activities.map((activity) => {
                    const secondaryLabel = getEventSecondaryLabel(activity.event_type, activity.event_data);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 p-2 rounded-md bg-secondary/30"
                      >
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                          {getEventIcon(activity.event_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {getEventLabel(activity.event_type, activity.event_data)}
                          </p>
                          {secondaryLabel && <p className="text-xs text-muted-foreground truncate">{secondaryLabel}</p>}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
