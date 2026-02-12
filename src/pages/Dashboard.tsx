import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import YachtCard from '@/components/yacht/YachtCard';
import YachtDetail from '@/components/yacht/YachtDetail';
import AddYachtDialog from '@/components/yacht/AddYachtDialog';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Ship } from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';

interface Yacht {
  id: string;
  name: string;
  slug: string;
  vessel_type: string;
  capacity: number;
  team_description: string | null;
  sales_description: string | null;
  public_price: number | null;
  commission_amount: number | null;
  owner_notes: string | null;
  cal_embed_url: string | null;
  cal_event_type_id: number | null;
  booking_mode: string;
  booking_public_enabled: boolean;
  booking_v2_live_from: string | null;
  is_flagship: boolean | null;
  display_order: number | null;
}

interface YachtImage {
  id: string;
  yacht_id: string;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  display_order: number | null;
}

export default function Dashboard() {
  const { isLoading: authLoading, isAdmin } = useAuth();
  const { trackYachtView, trackCopy } = useActivityTracker();
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [images, setImages] = useState<YachtImage[]>([]);
  const [selectedYachtId, setSelectedYachtId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleYachtSelect = (yacht: Yacht) => {
    setSelectedYachtId(yacht.id);
    trackYachtView(yacht.id, yacht.name);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch yachts
      const { data: yachtsData, error: yachtsError } = await supabase
        .from('yachts')
        .select('*')
        .order('display_order', { ascending: true });

      if (yachtsError) throw yachtsError;

      // Fetch images
      const { data: imagesData, error: imagesError } = await supabase
        .from('yacht_images')
        .select('*')
        .order('display_order', { ascending: true });

      if (imagesError) throw imagesError;

      setYachts(yachtsData || []);
      setImages(imagesData || []);

      // Auto-select flagship or first yacht
      if (yachtsData && yachtsData.length > 0) {
        const flagship = yachtsData.find((y) => y.is_flagship);
        setSelectedYachtId(flagship?.id || yachtsData[0].id);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load yacht data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading]);

  const selectedYacht = yachts.find((y) => y.id === selectedYachtId);
  const selectedYachtImages = images.filter((img) => img.yacht_id === selectedYachtId);

  const getYachtPrimaryImage = (yachtId: string): string | undefined => {
    const yachtImages = images.filter((img) => img.yacht_id === yachtId);
    const primary = yachtImages.find((img) => img.is_primary);
    
    // Only return uploaded images, otherwise undefined for gray placeholder
    if (primary?.image_url) return primary.image_url;
    if (yachtImages[0]?.image_url) return yachtImages[0].image_url;
    
    return undefined;
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-52 rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (yachts.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <Ship className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No Yachts Available</h2>
          <p className="text-muted-foreground max-w-md">
            There are no yachts configured in the system yet. Please contact your administrator to add yacht information.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Yacht Selection - Horizontal scroll on mobile */}
        <section>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-base md:text-lg font-semibold text-foreground">Select a Yacht</h2>
            {isAdmin && <AddYachtDialog onSuccess={fetchData} />}
          </div>
          <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible scrollbar-hide">
            {yachts.map((yacht) => (
              <div key={yacht.id} className="flex-shrink-0 w-56 md:w-auto">
                <YachtCard
                  id={yacht.id}
                  name={yacht.name}
                  vesselType={yacht.vessel_type}
                  capacity={yacht.capacity}
                  isFlagship={yacht.is_flagship || false}
                  imageUrl={getYachtPrimaryImage(yacht.id)}
                  isSelected={yacht.id === selectedYachtId}
                  isAdmin={isAdmin}
                  onClick={() => handleYachtSelect(yacht)}
                  onUpdate={fetchData}
                  compact
                />
              </div>
            ))}
          </div>
        </section>

        {/* Yacht Details */}
        {selectedYacht && (
          <section>
            <YachtDetail
              yacht={selectedYacht}
              images={selectedYachtImages}
              onUpdate={fetchData}
              defaultImage={getYachtPrimaryImage(selectedYacht.id)}
              onCopy={trackCopy}
            />
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
