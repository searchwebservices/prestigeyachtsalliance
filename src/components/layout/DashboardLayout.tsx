import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Anchor, CalendarDays, Calendar as CalendarIcon, LogOut, Users, Menu, Settings as SettingsIcon } from 'lucide-react';
import { uiText } from '@/lib/uiText';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, isAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();
      if (data?.full_name) setFullName(data.full_name);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchProfile();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Get initials from full name (first & last) or fallback to email
  const getInitials = () => {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    return user?.email ? user.email.substring(0, 2).toUpperCase() : 'U';
  };

  const displayName = fullName || user?.email || 'User';
  const copy = uiText[language];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-14 md:h-16 items-center justify-between px-4">
          {/* Mobile Header */}
          <div className="flex md:hidden items-center gap-2 min-w-0 flex-1">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader className="text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <Anchor className="w-5 h-5 text-primary" />
                    Prestige Yachts
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-6">
                  <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {copy.teamPortal}
                  </p>
                  <Button
                    variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'}
                    className="justify-start h-11"
                    onClick={() => handleNavigation('/dashboard')}
                  >
                    <Anchor className="w-4 h-4 mr-3" />
                    {copy.yachts}
                  </Button>
                  <Button
                    variant={location.pathname === '/book' ? 'secondary' : 'ghost'}
                    className="justify-start h-11"
                    onClick={() => handleNavigation('/book')}
                  >
                    <CalendarDays className="w-4 h-4 mr-3" />
                    {copy.book}
                  </Button>
                  {isAdmin && (
                    <>
                      <p className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Admin
                      </p>
                      <Button
                        variant={location.pathname === '/calendar' ? 'secondary' : 'ghost'}
                        className="justify-start h-11"
                        onClick={() => handleNavigation('/calendar')}
                      >
                        <CalendarIcon className="w-4 h-4 mr-3" />
                        {copy.calendar}
                      </Button>
                      <Button
                        variant={location.pathname === '/team' ? 'secondary' : 'ghost'}
                        className="justify-start h-11"
                        onClick={() => handleNavigation('/team')}
                      >
                        <Users className="w-4 h-4 mr-3" />
                        {copy.team}
                      </Button>
                    </>
                  )}
                  <div className="border-t border-border my-4" />
                  <div className="px-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Preferences
                    </p>
                    <ThemeToggle />
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <Button
                    variant={location.pathname === '/settings' ? 'secondary' : 'ghost'}
                    className="justify-start h-11"
                    onClick={() => handleNavigation('/settings')}
                  >
                    <SettingsIcon className="w-4 h-4 mr-3" />
                    {copy.settings}
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start h-11 text-destructive hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    {copy.signOut}
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Anchor className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground tracking-tight truncate">
                Prestige Yachts
              </span>
            </div>
          </div>

          {/* Logo */}
          <div className="hidden md:flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Anchor className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-base md:text-lg font-semibold text-foreground tracking-tight">
                Prestige Yachts
              </span>
              <span className="text-[10px] md:text-xs text-muted-foreground -mt-0.5 hidden sm:block">
                {copy.teamPortal}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <Anchor className="w-4 h-4 mr-2" />
              {copy.yachts}
            </Button>
            <Button
              variant={location.pathname === '/book' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/book')}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              {copy.book}
            </Button>
            {isAdmin && (
              <Button
                variant={location.pathname === '/calendar' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => navigate('/calendar')}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                {copy.calendar}
              </Button>
            )}
            {isAdmin && (
              <Button
                variant={location.pathname === '/team' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => navigate('/team')}
              >
                <Users className="w-4 h-4 mr-2" />
                {copy.team}
              </Button>
            )}
            <Button
              variant={location.pathname === '/settings' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/settings')}
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              {copy.settings}
            </Button>
          </nav>

          <div className="hidden md:flex items-center gap-1 md:gap-2">
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 md:h-10 px-2 md:px-3 gap-2 md:gap-3">
                  <Avatar className="h-7 w-7 md:h-8 md:w-8 border border-border">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs md:text-sm font-medium">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block text-sm font-medium text-foreground max-w-[150px] truncate">
                    {displayName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  {copy.settings}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {copy.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-4 md:py-8 px-4">
        {children}
      </main>
    </div>
  );
}
