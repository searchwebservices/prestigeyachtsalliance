import { Link } from 'react-router-dom';
import { Anchor, ArrowRight, Compass } from 'lucide-react';
import HeroBackdrop from '@/components/reserve/HeroBackdrop';

export default function Reserve() {
  return (
    <HeroBackdrop>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 md:px-12 md:py-16">
        <header className="text-white">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-white/70 md:text-sm">
            Prestige Yachts Alliance
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Your day on the water in Cabo, your way.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 md:text-lg">
            Tell us where you are in the journey — we'll take it from here.
          </p>
        </header>

        <div className="mt-12 grid flex-1 gap-5 md:mt-16 md:grid-cols-2 md:items-center md:gap-6">
          <Link
            to="/reserve/book"
            className="group relative block overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-white/40 hover:bg-white/15 md:p-10"
          >
            <div className="flex items-center gap-3 text-white/80">
              <Anchor className="h-5 w-5" />
              <span className="text-[11px] font-medium uppercase tracking-[0.3em]">I know what I want</span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold leading-tight text-white md:text-3xl">
              Pick your experience and the days that work.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/75 md:text-base">
              Tell us the experience you're after and a couple of dates that fit your trip — we'll
              call to lock in the perfect day on the water.
            </p>
            <div className="mt-10 flex items-center gap-2 text-white">
              <span className="text-sm font-medium">Reserve your day</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/reserve/inquire"
            className="group relative block overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-white/40 hover:bg-white/15 md:p-10"
          >
            <div className="flex items-center gap-3 text-white/80">
              <Compass className="h-5 w-5" />
              <span className="text-[11px] font-medium uppercase tracking-[0.3em]">Just exploring</span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold leading-tight text-white md:text-3xl">
              I'm not sure yet — show me my options.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/75 md:text-base">
              Tell us a bit about who's coming and what you'd love to do. Our team will reach out
              with curated options.
            </p>
            <div className="mt-10 flex items-center gap-2 text-white">
              <span className="text-sm font-medium">Tell us about your trip</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        <footer className="mt-12 text-center text-xs text-white/55 md:mt-16">
          Crafted in Cabo San Lucas · Prestige Yachts Alliance
        </footer>
      </div>
    </HeroBackdrop>
  );
}
