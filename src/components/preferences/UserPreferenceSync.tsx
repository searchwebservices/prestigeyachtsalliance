import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const isValidTheme = (value: unknown): value is "light" | "dark" | "system" =>
  value === "light" || value === "dark" || value === "system";

const isValidLanguage = (value: unknown): value is AppLanguage => value === "en" || value === "es";

export default function UserPreferenceSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const { setLanguage } = useLanguage();

  useEffect(() => {
    let active = true;

    const syncFromProfile = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("preferred_theme,preferred_language")
        .eq("id", user.id)
        .maybeSingle();

      if (!active || error || !data) return;

      if (isValidTheme(data.preferred_theme)) {
        setTheme(data.preferred_theme);
      }

      if (isValidLanguage(data.preferred_language)) {
        setLanguage(data.preferred_language);
      }
    };

    void syncFromProfile();

    return () => {
      active = false;
    };
  }, [user?.id, setLanguage, setTheme]);

  return null;
}

