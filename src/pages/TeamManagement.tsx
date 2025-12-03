import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UserDetailsDialog } from '@/components/team/UserDetailsDialog';
import { 
  Shield, 
  User, 
  AlertCircle, 
  Users,
  ArrowLeft,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export default function TeamManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('get-users');

      if (response.error) {
        console.error('Edge function error:', response.error);
        setError('Failed to load team members');
      } else {
        setUsers(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user: TeamUser) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Skeleton className="h-8 w-32" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <Users className="h-6 w-6" />
                Team Management
              </h1>
              <p className="text-muted-foreground text-sm">
                View and manage team members and their activity
              </p>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Users Table */}
        {!loading && !error && (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No team members found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => handleUserClick(user)}
                    >
                      <TableCell className="font-medium">
                        {user.full_name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                        >
                          {user.role === 'admin' ? (
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
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.last_sign_in_at
                          ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Activity className="w-4 h-4" />
                          <span>{user.activity_count}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <UserDetailsDialog
        user={selectedUser}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </DashboardLayout>
  );
}
