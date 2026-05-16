import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Anchor, Users, Clock, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Listing = {
  id: string;
  yacht_id: string;
  title: string | null;
  show_description: boolean;
  show_pricing: boolean;
  is_published: boolean;
};

type Yacht = {
  name: string;
  vessel_type: string;
  capacity: number;
  hourly_rate: number | null;
  public_price: number | null;
  sales_description: string | null;
  is_flagship: boolean | null;
};

type YachtImage = {
  id: string;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  display_order: number | null;
};

type PaymentLink = {
  id: string;
  duration_hours: number;
  label: string | null;
  amount_usd: number | null;
  stripe_url: string;
  sort_order: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

// ── Page ──────────────────────────────────────────────────────────────────────

export default function YachtListing() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<'loading' | 'not_found' | 'ready'>('loading');
  const [listing, setListing] = useState<Listing | null>(null);
  const [yacht, setYacht] = useState<Yacht | null>(null);
  const [images, setImages] = useState<YachtImage[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    if (!slug) { setStatus('not_found'); return; }

    const load = async () => {
      // 1. Listing
      const { data: listingData } = await supabase
        .from('yacht_listings')
        .select('id, yacht_id, title, show_description, show_pricing, is_published')
        .eq('listing_slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (!listingData) { setStatus('not_found'); return; }
      setListing(listingData);

      // 2. Yacht
      const { data: yachtData } = await supabase
        .from('yachts')
        .select('name, vessel_type, capacity, hourly_rate, public_price, sales_description, is_flagship')
        .eq('id', listingData.yacht_id)
        .maybeSingle();

      if (!yachtData) { setStatus('not_found'); return; }
      setYacht(yachtData);

      // 3. Images
      const { data: imgData } = await supabase
        .from('yacht_images')
        .select('id, image_url, alt_text, is_primary, display_order')
        .eq('yacht_id', listingData.yacht_id)
        .order('display_order', { ascending: true });

      const sorted = (imgData ?? []).sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return (a.display_order ?? 99) - (b.display_order ?? 99);
      });
      setImages(sorted);

      // 4. Payment links (only if show_pricing)
      if (listingData.show_pricing) {
        const { data: linkData } = await supabase
          .from('yacht_payment_links')
          .select('id, duration_hours, label, amount_usd, stripe_url, sort_order')
          .eq('yacht_id', listingData.yacht_id)
          .order('sort_order', { ascending: true });
        setPaymentLinks(linkData ?? []);
      }

      setStatus('ready');
    };

    load();
  }, [slug]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Anchor className="w-8 h-8 text-[#b8965a] animate-pulse" />
          <p className="text-[#8a9ab0] text-sm tracking-widest uppercase">Loading</p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (status === 'not_found' || !yacht || !listing) {
    return (
      <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center px-6">
        <div className="text-center">
          <Anchor className="w-10 h-10 text-[#b8965a] mx-auto mb-6 opacity-50" />
          <h1 className="text-2xl font-semibold text-white mb-2">Page not found</h1>
          <p className="text-[#8a9ab0] text-sm">This listing may have been removed or the link is incorrect.</p>
          <p className="text-[#b8965a] text-xs mt-6 tracking-widest uppercase">Prestige Yachts Alliance</p>
        </div>
      </div>
    );
  }

  const hero = images[heroIdx];
  const prevHero = () => setHeroIdx((i) => (i - 1 + images.length) % images.length);
  const nextHero = () => setHeroIdx((i) => (i + 1) % images.length);

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="relative h-[70vh] min-h-[440px] overflow-hidden">
        {hero ? (
          <img
            src={hero.image_url}
            alt={hero.alt_text ?? yacht.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1520] to-[#1a2535]" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] via-[#0a0e14]/40 to-transparent" />

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevHero}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={nextHero}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === heroIdx ? 'bg-[#b8965a] w-4' : 'bg-white/30'}`}
              />
            ))}
          </div>
        )}

        {/* Wordmark */}
        <div className="absolute top-6 left-6 flex items-center gap-2">
          <Anchor className="w-5 h-5 text-[#b8965a]" />
          <span className="text-xs tracking-[0.2em] uppercase text-white/70 font-light">Prestige Yachts Alliance</span>
        </div>

        {/* Yacht identity */}
        <div className="absolute bottom-0 left-0 right-0 px-6 md:px-12 pb-10">
          {listing.title && (
            <p className="text-[#b8965a] text-xs tracking-[0.25em] uppercase mb-2 font-light">{listing.title}</p>
          )}
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-none">
            {yacht.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <span className="text-white/60 text-sm">{yacht.vessel_type}</span>
            <span className="w-px h-3 bg-white/20" />
            <span className="text-white/60 text-sm flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Up to {yacht.capacity} guests
            </span>
            {yacht.is_flagship && (
              <>
                <span className="w-px h-3 bg-white/20" />
                <span className="text-[#b8965a] text-xs tracking-widest uppercase">Flagship</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Image Strip ─────────────────────────────────────────────────────── */}
      {images.length > 1 && (
        <div className="px-6 md:px-12 py-6 overflow-x-auto">
          <div className="flex gap-3 w-max">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setHeroIdx(i)}
                className={`flex-shrink-0 w-24 h-16 md:w-32 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  i === heroIdx ? 'border-[#b8965a]' : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              >
                <img src={img.image_url} alt={img.alt_text ?? yacht.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 pb-24 space-y-16">

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10" />
          <Anchor className="w-4 h-4 text-[#b8965a] opacity-60" />
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Description */}
        {listing.show_description && yacht.sales_description && (
          <section className="space-y-4">
            <h2 className="text-xs tracking-[0.25em] uppercase text-[#b8965a] font-medium">About</h2>
            <p className="text-[#c8d4e0] leading-relaxed text-base md:text-lg whitespace-pre-line">
              {yacht.sales_description}
            </p>
          </section>
        )}

        {/* Pricing + Payment links */}
        {listing.show_pricing && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xs tracking-[0.25em] uppercase text-[#b8965a] font-medium mb-3">Charter Rate</h2>
              {yacht.hourly_rate ? (
                <div className="flex items-end gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-white">{usd.format(yacht.hourly_rate)}</span>
                  <span className="text-[#8a9ab0] text-lg mb-1">/ hour</span>
                </div>
              ) : (
                <p className="text-[#8a9ab0]">Contact us for pricing</p>
              )}
            </div>

            {paymentLinks.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs tracking-[0.2em] uppercase text-white/40 font-light">Select your charter duration</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {paymentLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.stripe_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#b8965a]/50 transition-all p-5 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3.5 h-3.5 text-[#b8965a]" />
                          <span className="text-white font-semibold">
                            {link.duration_hours} {link.duration_hours === 1 ? 'Hour' : 'Hours'}
                          </span>
                        </div>
                        {link.label && (
                          <p className="text-xs text-[#8a9ab0]">{link.label}</p>
                        )}
                        {link.amount_usd && (
                          <p className="text-xl font-bold text-white mt-2">{usd.format(link.amount_usd)}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <div className="w-9 h-9 rounded-full bg-[#b8965a]/15 group-hover:bg-[#b8965a]/30 border border-[#b8965a]/30 group-hover:border-[#b8965a] flex items-center justify-center transition-all">
                          <ExternalLink className="w-4 h-4 text-[#b8965a]" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
                <p className="text-[10px] text-white/20 text-center pt-2">
                  Secure payment powered by Stripe
                </p>
              </div>
            )}
          </section>
        )}

      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 md:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Anchor className="w-4 h-4 text-[#b8965a]" />
          <span className="text-xs tracking-[0.2em] uppercase text-white/40 font-light">Prestige Yachts Alliance</span>
        </div>
        <p className="text-[10px] text-white/20">All charters subject to availability and terms.</p>
      </footer>

    </div>
  );
}
