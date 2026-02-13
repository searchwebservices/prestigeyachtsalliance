import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings2, UserCircle2, Palette, History, RefreshCw, Save, CheckCircle2, AlertCircle } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import AvatarUpload from "@/components/settings/AvatarUpload";

type ThemePreference = "light" | "dark" | "system";
type ProfileSettings = {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  preferred_theme: ThemePreference;
  preferred_language: AppLanguage;
};

type TeamOption = {
  id: string;
  email: string;
  full_name: string | null;
};

type BookingNote = {
  id: string;
  note: string;
  createdAt: string;
  authorUserId: string;
  authorName: string;
  authorEmail: string;
};

type BookingHistoryItem = {
  transactionId: string;
  bookingUid: string | null;
  status: string | null;
  yachtName: string;
  yachtSlug: string;
  tripDate: string;
  tripTimeRange: string;
  requestedHours: number | null;
  segment: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookedAt: string;
  bookedByUserId: string;
  bookedByName: string;
  bookedByEmail: string;
  notes: BookingNote[];
};

type ActivityRow = {
  id: string;
  user_id: string;
  event_type: string;
  event_data: Json | null;
  created_at: string;
};

const SETTINGS_COPY: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    tabProfile: string;
    tabPreferences: string;
    tabHistory: string;
    profileTitle: string;
    profileDescription: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    preferencesTitle: string;
    preferencesDescription: string;
    theme: string;
    language: string;
    saveSettings: string;
    savedTitle: string;
    savedDescription: string;
    historyTitle: string;
    historyDescription: string;
    historyOwnOnly: string;
    historyAllUsers: string;
    selectUsers: string;
    refresh: string;
    noHistory: string;
    bookingBy: string;
    addNote: string;
    notePlaceholder: string;
    notesLabel: string;
    noNotes: string;
    requestAdminHint: string;
    transactionId: string;
    status: string;
    boat: string;
    tripDate: string;
    timeRange: string;
    client: string;
    segment: string;
    loadingHistory: string;
    failedLoadHistory: string;
    failedSave: string;
  }
> = {
  en: {
    title: "Settings",
    subtitle: "Manage your profile, preferences, and booking history.",
    tabProfile: "Profile",
    tabPreferences: "Preferences",
    tabHistory: "Trip History",
    profileTitle: "Profile",
    profileDescription: "Update your personal information.",
    fullName: "Full Name",
    phoneNumber: "Phone Number",
    email: "Email",
    preferencesTitle: "Preferences",
    preferencesDescription: "Theme and language choices for your account.",
    theme: "Theme Preference",
    language: "Language Preference",
    saveSettings: "Save Settings",
    savedTitle: "Settings saved",
    savedDescription: "Your profile and preferences were updated.",
    historyTitle: "Trips Booked",
    historyDescription:
      "Historical booking records. You can add notes to request admin changes, but cannot edit booking records.",
    historyOwnOnly: "Show only my bookings",
    historyAllUsers: "Show all users",
    selectUsers: "Select team members",
    refresh: "Refresh",
    noHistory: "No booking history found.",
    bookingBy: "Booked by",
    addNote: "Add Note",
    notePlaceholder: "Add internal note and request admin changes...",
    notesLabel: "Notes",
    noNotes: "No notes yet.",
    requestAdminHint: "Notes are append-only and intended to request admin changes.",
    transactionId: "Transaction ID",
    status: "Status",
    boat: "Boat",
    tripDate: "Trip Date",
    timeRange: "Time Range",
    client: "Client",
    segment: "Segment",
    loadingHistory: "Loading booking history...",
    failedLoadHistory: "Failed to load booking history.",
    failedSave: "Failed to save settings.",
  },
  es: {
    title: "Configuración",
    subtitle: "Administra tu perfil, preferencias e historial de reservas.",
    tabProfile: "Perfil",
    tabPreferences: "Preferencias",
    tabHistory: "Historial de viajes",
    profileTitle: "Perfil",
    profileDescription: "Actualiza tu información personal.",
    fullName: "Nombre completo",
    phoneNumber: "Teléfono",
    email: "Correo electrónico",
    preferencesTitle: "Preferencias",
    preferencesDescription: "Tema e idioma para tu cuenta.",
    theme: "Preferencia de tema",
    language: "Preferencia de idioma",
    saveSettings: "Guardar configuración",
    savedTitle: "Configuración guardada",
    savedDescription: "Tu perfil y preferencias se actualizaron.",
    historyTitle: "Viajes reservados",
    historyDescription:
      "Registros históricos de reservas. Puedes agregar notas para solicitar cambios al admin, pero no editar reservas históricas.",
    historyOwnOnly: "Mostrar solo mis reservas",
    historyAllUsers: "Mostrar todos los usuarios",
    selectUsers: "Seleccionar miembros del equipo",
    refresh: "Actualizar",
    noHistory: "No se encontró historial de reservas.",
    bookingBy: "Reservado por",
    addNote: "Agregar nota",
    notePlaceholder: "Agrega nota interna para solicitar cambios al admin...",
    notesLabel: "Notas",
    noNotes: "Aún no hay notas.",
    requestAdminHint: "Las notas son solo anexos y se usan para solicitar cambios al admin.",
    transactionId: "ID de transacción",
    status: "Estado",
    boat: "Barco",
    tripDate: "Fecha del viaje",
    timeRange: "Horario",
    client: "Cliente",
    segment: "Segmento",
    loadingHistory: "Cargando historial de reservas...",
    failedLoadHistory: "No se pudo cargar el historial de reservas.",
    failedSave: "No se pudo guardar la configuración.",
  },
};

const asRecord = (value: Json | null): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeSegment = (value: unknown) => {
  const segment = asString(value).toLowerCase();
  if (segment === "am" || segment === "pm") return segment.toUpperCase();
  if (segment === "flexible") return "FLEXIBLE";
  return "";
};

const buildBookingHistory = (
  rows: ActivityRow[],
  profilesMap: Map<string, { full_name: string | null; email: string }>
): BookingHistoryItem[] => {
  const bookings = new Map<string, BookingHistoryItem>();
  const noteEvents: Array<{
    transactionId: string;
    note: BookingNote;
  }> = [];

  const chronological = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const row of chronological) {
    const data = asRecord(row.event_data);
    const transactionId =
      asString(data.booking_transaction_id) || asString(data.booking_uid) || row.id;
    if (!transactionId) continue;

    const profile = profilesMap.get(row.user_id);
    const bookedByName = profile?.full_name || profile?.email || "Unknown user";
    const bookedByEmail = profile?.email || "";

    if (row.event_type === "trip_booked") {
      bookings.set(transactionId, {
        transactionId,
        bookingUid: asString(data.booking_uid) || null,
        status: asString(data.booking_status) || null,
        yachtName: asString(data.yacht_name) || "Unknown yacht",
        yachtSlug: asString(data.yacht_slug) || "",
        tripDate: asString(data.trip_date) || "Unknown date",
        tripTimeRange: asString(data.trip_time_range) || "Unknown time",
        requestedHours: asNumber(data.requested_hours),
        segment: normalizeSegment(data.segment) || normalizeSegment(data.selected_half) || null,
        customerName: asString(data.customer_name) || "Unknown customer",
        customerEmail: asString(data.customer_email) || "",
        customerPhone: asString(data.customer_phone) || "",
        bookedAt: row.created_at,
        bookedByUserId: row.user_id,
        bookedByName,
        bookedByEmail,
        notes: [],
      });
      continue;
    }

    if (row.event_type === "trip_booking_note") {
      const noteText = asString(data.note_text).trim();
      if (!noteText) continue;

      noteEvents.push({
        transactionId,
        note: {
          id: row.id,
          note: noteText,
          createdAt: row.created_at,
          authorUserId: row.user_id,
          authorName: bookedByName,
          authorEmail: bookedByEmail,
        },
      });
    }
  }

  for (const noteEvent of noteEvents) {
    const booking = bookings.get(noteEvent.transactionId);
    if (!booking) continue;
    booking.notes.push(noteEvent.note);
  }

  return [...bookings.values()].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
};

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const { setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [languagePreference, setLanguagePreference] = useState<AppLanguage>(language);

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [historyRows, setHistoryRows] = useState<BookingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);

  const copy = SETTINGS_COPY[language];

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoadingProfile(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,phone_number,preferred_theme,preferred_language,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      toast({
        variant: "destructive",
        title: "Error",
        description: copy.failedSave,
      });
      setLoadingProfile(false);
      return;
    }

    const normalizedTheme =
      data.preferred_theme === "light" || data.preferred_theme === "dark" || data.preferred_theme === "system"
        ? data.preferred_theme
        : "system";
    const normalizedLanguage = data.preferred_language === "es" ? "es" : "en";

    const nextProfile: ProfileSettings = {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      phone_number: data.phone_number,
      preferred_theme: normalizedTheme,
      preferred_language: normalizedLanguage,
    };

    setProfile(nextProfile);
    setFullName(nextProfile.full_name || "");
    setPhoneNumber(nextProfile.phone_number || "");
    setAvatarUrl(data.avatar_url);
    setThemePreference(nextProfile.preferred_theme);
    setLanguagePreference(nextProfile.preferred_language);
    setLoadingProfile(false);
  }, [copy.failedSave, toast, user?.id]);

  const loadTeamOptions = useCallback(async () => {
    if (!isAdmin) return;
    const response = await supabase.functions.invoke("get-users");
    if (response.error) return;
    const rows = (response.data || []) as TeamOption[];
    setTeamOptions(rows);
  }, [isAdmin]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      let query = supabase
        .from("user_activity")
        .select("id,user_id,event_type,event_data,created_at")
        .in("event_type", ["trip_booked", "trip_booking_note"])
        .order("created_at", { ascending: false })
        .limit(2000);

      if (isAdmin) {
        if (!showAllUsers) {
          if (selectedUserIds.length === 0) {
            setHistoryRows([]);
            setHistoryLoading(false);
            return;
          }
          query = query.in("user_id", selectedUserIds);
        }
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const activityRows = (data || []) as ActivityRow[];
      const userIds = Array.from(new Set(activityRows.map((row) => row.user_id)));
      const profilesMap = new Map<string, { full_name: string | null; email: string }>();

      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);

        for (const profileRow of profileRows || []) {
          profilesMap.set(profileRow.id, {
            full_name: profileRow.full_name,
            email: profileRow.email,
          });
        }
      }

      setHistoryRows(buildBookingHistory(activityRows, profilesMap));
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.failedLoadHistory;
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, [copy.failedLoadHistory, isAdmin, selectedUserIds, showAllUsers, user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadTeamOptions();
  }, [loadTeamOptions]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const saveSettings = async () => {
    if (!user?.id) return;
    setSaving(true);

    const payload = {
      full_name: fullName.trim() || null,
      phone_number: phoneNumber.trim() || null,
      preferred_theme: themePreference,
      preferred_language: languagePreference,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: copy.failedSave,
      });
      setSaving(false);
      return;
    }

    setTheme(themePreference);
    setLanguage(languagePreference);
    setProfile((current) =>
      current
        ? {
            ...current,
            ...payload,
          }
        : current
    );

    toast({
      title: copy.savedTitle,
      description: copy.savedDescription,
    });

    setSaving(false);
  };

  const addNote = async (booking: BookingHistoryItem) => {
    if (!user?.id) return;

    const noteText = (noteDrafts[booking.transactionId] || "").trim();
    if (!noteText) return;

    setAddingNoteFor(booking.transactionId);

    const { error } = await supabase.from("user_activity").insert({
      user_id: user.id,
      event_type: "trip_booking_note",
      event_data: {
        booking_transaction_id: booking.transactionId,
        booking_uid: booking.bookingUid || "",
        note_text: noteText,
        request_admin_change: true,
        yacht_name: booking.yachtName,
        yacht_slug: booking.yachtSlug,
        trip_date: booking.tripDate,
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: copy.failedSave,
      });
      setAddingNoteFor(null);
      return;
    }

    setNoteDrafts((current) => ({
      ...current,
      [booking.transactionId]: "",
    }));

    await loadHistory();
    setAddingNoteFor(null);
  };

  const toggleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        if (current.includes(userId)) return current;
        return [...current, userId];
      }
      return current.filter((id) => id !== userId);
    });
  };

  const selectedUsersLabel = useMemo(() => {
    if (showAllUsers) return copy.historyAllUsers;
    if (selectedUserIds.length === 0) return `${copy.selectUsers}: 0`;
    return `${copy.selectUsers}: ${selectedUserIds.length}`;
  }, [copy.historyAllUsers, copy.selectUsers, selectedUserIds.length, showAllUsers]);

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-max min-w-full whitespace-nowrap md:grid md:w-full md:grid-cols-3">
              <TabsTrigger value="profile" className="min-w-[8.5rem] md:min-w-0">
                <UserCircle2 className="hidden h-4 w-4 md:mr-2 md:inline-flex" aria-hidden="true" />
                {copy.tabProfile}
              </TabsTrigger>
              <TabsTrigger value="preferences" className="min-w-[8.5rem] md:min-w-0">
                <Palette className="hidden h-4 w-4 md:mr-2 md:inline-flex" aria-hidden="true" />
                {copy.tabPreferences}
              </TabsTrigger>
              <TabsTrigger value="history" className="min-w-[10.5rem] md:min-w-0">
                <History className="hidden h-4 w-4 md:mr-2 md:inline-flex" aria-hidden="true" />
                {copy.tabHistory}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>{copy.profileTitle}</CardTitle>
                <CardDescription>{copy.profileDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user && (
                  <div className="space-y-2">
                    <Label>Avatar</Label>
                    <AvatarUpload
                      userId={user.id}
                      currentUrl={avatarUrl}
                      fallbackInitials={
                        (fullName || profile?.email || "U")
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      }
                      onUploaded={setAvatarUrl}
                      disabled={loadingProfile}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="settings-email">{copy.email}</Label>
                  <Input
                    id="settings-email"
                    value={profile?.email || ""}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-name">{copy.fullName}</Label>
                  <Input
                    id="settings-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={loadingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-phone">{copy.phoneNumber}</Label>
                  <Input
                    id="settings-phone"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+52..."
                    disabled={loadingProfile}
                  />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end mt-4">
              <Button onClick={saveSettings} disabled={saving || loadingProfile}>
                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {copy.saveSettings}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>{copy.preferencesTitle}</CardTitle>
                <CardDescription>{copy.preferencesDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{copy.theme}</Label>
                  <Select
                    value={themePreference}
                    onValueChange={(value) => setThemePreference(value as ThemePreference)}
                    disabled={loadingProfile}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{copy.language}</Label>
                  <Select
                    value={languagePreference}
                    onValueChange={(value) => setLanguagePreference(value as AppLanguage)}
                    disabled={loadingProfile}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving || loadingProfile}>
                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {copy.saveSettings}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{copy.historyTitle}</CardTitle>
                <CardDescription>{copy.historyDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin && (
                  <div className="rounded-md border border-border/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{selectedUsersLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="all-users">{copy.historyAllUsers}</Label>
                        <Switch
                          id="all-users"
                          checked={showAllUsers}
                          onCheckedChange={(checked) => setShowAllUsers(Boolean(checked))}
                        />
                      </div>
                    </div>
                    {!showAllUsers && (
                      <div className="max-h-52 overflow-y-auto rounded-md border border-border/60 p-2 space-y-2">
                        {teamOptions.map((teamUser) => (
                          <label key={teamUser.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedUserIds.includes(teamUser.id)}
                              onCheckedChange={(checked) => toggleUserSelection(teamUser.id, Boolean(checked))}
                            />
                            <span>{teamUser.full_name || teamUser.email}</span>
                            <span className="text-xs text-muted-foreground">({teamUser.email})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void loadHistory()} disabled={historyLoading}>
                    {historyLoading ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {copy.refresh}
                  </Button>
                </div>

                {historyError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{copy.failedLoadHistory}</AlertTitle>
                    <AlertDescription>{historyError}</AlertDescription>
                  </Alert>
                )}

                {historyLoading ? (
                  <p className="text-sm text-muted-foreground">{copy.loadingHistory}</p>
                ) : historyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.noHistory}</p>
                ) : (
                  <div className="space-y-4">
                    {historyRows.map((booking) => (
                      <Card key={booking.transactionId} className="border-border/60">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {copy.transactionId}: {booking.transactionId}
                            </p>
                            {booking.status ? <Badge>{booking.status}</Badge> : null}
                          </div>

                          <div className="grid gap-2 text-sm md:grid-cols-2">
                            <p>
                              <span className="font-medium">{copy.boat}:</span> {booking.yachtName}
                            </p>
                            <p>
                              <span className="font-medium">{copy.tripDate}:</span> {booking.tripDate}
                            </p>
                            <p>
                              <span className="font-medium">{copy.timeRange}:</span> {booking.tripTimeRange}
                            </p>
                            <p>
                              <span className="font-medium">{copy.segment}:</span> {booking.segment || "N/A"}
                            </p>
                            <p>
                              <span className="font-medium">{copy.client}:</span> {booking.customerName}
                              {booking.customerEmail ? ` (${booking.customerEmail})` : ""}
                            </p>
                            {isAdmin ? (
                              <p>
                                <span className="font-medium">{copy.bookingBy}:</span> {booking.bookedByName}
                                {booking.bookedByEmail ? ` (${booking.bookedByEmail})` : ""}
                              </p>
                            ) : null}
                          </div>

                          <Separator />

                          <div className="space-y-2">
                            <p className="text-sm font-medium">{copy.notesLabel}</p>
                            {booking.notes.length === 0 ? (
                              <p className="text-xs text-muted-foreground">{copy.noNotes}</p>
                            ) : (
                              <div className="space-y-2">
                                {booking.notes.map((note) => (
                                  <div key={note.id} className="rounded-md border border-border/60 bg-muted/30 p-2">
                                    <p className="text-sm">{note.note}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {note.authorName} • {new Date(note.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <Textarea
                              value={noteDrafts[booking.transactionId] || ""}
                              onChange={(event) =>
                                setNoteDrafts((current) => ({
                                  ...current,
                                  [booking.transactionId]: event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder={copy.notePlaceholder}
                            />
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">{copy.requestAdminHint}</p>
                              <Button
                                size="sm"
                                onClick={() => void addNote(booking)}
                                disabled={
                                  addingNoteFor === booking.transactionId ||
                                  !(noteDrafts[booking.transactionId] || "").trim()
                                }
                              >
                                {addingNoteFor === booking.transactionId ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                {copy.addNote}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
