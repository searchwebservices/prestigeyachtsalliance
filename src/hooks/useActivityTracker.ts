import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export function useActivityTracker() {
  const { user } = useAuth();
  const hasTrackedPageLoad = useRef(false);

  const trackEvent = useCallback(async (
    eventType: string,
    eventData: Record<string, string | number | boolean | null> = {}
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('user_activity').insert([{
        user_id: user.id,
        event_type: eventType,
        event_data: eventData as Json,
      }]);

      if (error) {
        console.error('Failed to track activity:', error);
      }
    } catch (err) {
      console.error('Activity tracking error:', err);
    }
  }, [user]);

  const trackPageLoad = useCallback(() => {
    if (hasTrackedPageLoad.current) return;
    hasTrackedPageLoad.current = true;
    trackEvent('page_load', { page: window.location.pathname });
  }, [trackEvent]);

  const trackCopy = useCallback((content: string, context?: string) => {
    trackEvent('copy_text', { 
      content_preview: content.substring(0, 100),
      context 
    });
  }, [trackEvent]);

  const trackYachtView = useCallback((yachtId: string, yachtName: string) => {
    trackEvent('yacht_view', { yacht_id: yachtId, yacht_name: yachtName });
  }, [trackEvent]);

  // Track page load on mount
  useEffect(() => {
    if (user) {
      trackPageLoad();
    }
  }, [user, trackPageLoad]);

  return {
    trackEvent,
    trackPageLoad,
    trackCopy,
    trackYachtView,
  };
}
