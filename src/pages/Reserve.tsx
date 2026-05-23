import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import HeroBackdrop from '@/components/reserve/HeroBackdrop';

const BG =
  'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/65bcc876-2023-4b04-be2c-4d80958999e3/1778898862256-0.jpg';

export default function Reserve() {
  return (
    <HeroBackdrop bgSrc={BG} overlayClassName="bg-black/45">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/55 px-8 py-10 text-white shadow-2xl backdrop-blur-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-white/45">
            Prestige Yachts Alliance · Cabo
          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Book a private charter.
          </h1>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              to="/reserve/book"
              className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-5 py-4 transition duration-200 hover:bg-white/20"
            >
              <div>
                <p className="font-medium">Choose a yacht</p>
                <p className="mt-0.5 text-xs text-white/55">Pick dates · we confirm</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              to="/reserve/inquire"
              className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-5 py-4 transition duration-200 hover:bg-white/20"
            >
              <div>
                <p className="font-medium">Ask a question</p>
                <p className="mt-0.5 text-xs text-white/55">We'll suggest the right charter</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </HeroBackdrop>
  );
}
