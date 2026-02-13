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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserDetailsDialog } from '@/components/team/UserDetailsDialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  User, 
  AlertCircle, 
  Users,
  ArrowLeft,
  Activity,
  Copy,
  Download
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

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

export default function TeamManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const getUserInitials = (user: TeamUser) => {
    if (user.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const handleCopyTable = async () => {
    const headers = ['Name', 'Email', 'Role', 'Last Active', 'Trips Booked', 'Activity Count'];
    const rows = users.map(user => [
      user.full_name || '—',
      user.email,
      user.role,
      user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy HH:mm') : 'Never',
      user.trips_booked.toString(),
      user.activity_count.toString()
    ]);
    
    const text = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Team data copied to clipboard.',
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'Name',
      'Email',
      'Role',
      'Member Since',
      'Last Active',
      'Page Loads',
      'Copy Events',
      'Yacht Views',
      'Trips Booked',
      'Total Activity',
    ];
    const rows = users.map(user => [
      user.full_name || '',
      user.email,
      user.role,
      format(new Date(user.created_at), 'yyyy-MM-dd'),
      user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'yyyy-MM-dd HH:mm:ss') : '',
      user.page_loads.toString(),
      user.copy_events.toString(),
      user.yacht_views.toString(),
      user.trips_booked.toString(),
      user.activity_count.toString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `team-members-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast({
      title: 'Exported!',
      description: 'Team data exported as CSV.',
    });
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
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="shrink-0 h-10 w-10 sm:h-11 sm:w-11 md:h-9 md:w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 md:h-6 md:w-6" />
                Team Management
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm">
                View and manage team members
              </p>
            </div>
          </div>
          
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:flex-nowrap md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTable}
              disabled={loading || users.length === 0}
              className="h-11 w-full sm:h-10 sm:w-auto md:h-9"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || users.length === 0}
              className="h-11 w-full sm:h-10 sm:w-auto md:h-9"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
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

        {/* Users Table - Desktop */}
        {!loading && !error && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Trips</TableHead>
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
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                                {getUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {user.full_name || '—'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
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
                          <Badge variant={user.trips_booked > 0 ? 'default' : 'secondary'}>
                            {user.trips_booked}
                          </Badge>
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

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No team members found
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="border border-border rounded-lg p-4 bg-card cursor-pointer active:bg-secondary/30 transition-colors"
                    onClick={() => handleUserClick(user)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border border-border shrink-0">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {user.full_name || '—'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                          <Badge
                            variant={user.role === 'admin' ? 'default' : 'secondary'}
                            className="shrink-0 text-xs"
                          >
                            {user.role === 'admin' ? 'Admin' : 'Staff'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            {user.last_sign_in_at
                              ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
                              : 'Never active'}
                          </span>
                          <span>
                            Trips: <span className="font-medium text-foreground">{user.trips_booked}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {user.activity_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <UserDetailsDialog
        user={selectedUser}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUserUpdate={fetchUsers}
      />
    </DashboardLayout>
  );
}
