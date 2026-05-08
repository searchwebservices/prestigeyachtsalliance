import { ReactNode } from 'react';
import yachtHero from '@/assets/yacht-hero.jpg';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
};

export default function HeroBackdrop({ children, className, overlayClassName }: Props) {
  return (
    <div className={cn('relative min-h-screen w-full overflow-hidden bg-slate-950', className)}>
      <img
        src={yachtHero}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/85',
          overlayClassName
        )}
      />
      <div className="relative z-10 min-h-screen w-full">{children}</div>
    </div>
  );
}
