import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  User, 
  Eye, 
  Copy, 
  Clock,
  Calendar,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface TeamUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  activity_count: number;
  page_loads: number;
  copy_events: number;
  yacht_views: number;
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
}

export function UserDetailsDialog({ user, open, onOpenChange }: UserDetailsDialogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchUserActivity();
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

  if (!user) return null;

  const userInitials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
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
      default:
        return eventType;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Team Member Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {user.full_name || 'No name set'}
              </h3>
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
            <h4 className="text-sm font-medium text-foreground mb-3">Recent Activity</h4>
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
                  {activities.map((activity) => (
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
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
