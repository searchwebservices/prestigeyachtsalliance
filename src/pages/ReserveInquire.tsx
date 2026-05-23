import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import HeroBackdrop from '@/components/reserve/HeroBackdrop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitToNetlifyForm } from '@/lib/netlifyForms';
import { cn } from '@/lib/utils';

const BG =
  'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/65bcc876-2023-4b04-be2c-4d80958999e3/1778898862256-0.jpg';

type Vibe = 'small' | 'group' | 'celebration' | 'open';

const VIBES: { value: Vibe; label: string; sub: string }[] = [
  { value: 'small',       label: 'Intimate',    sub: '1–8 guests' },
  { value: 'group',       label: 'Group',       sub: '9–24 guests' },
  { value: 'celebration', label: 'Event',       sub: 'Wedding / corporate' },
  { value: 'open',        label: 'Not sure',    sub: 'Tell us more below' },
];

const COUNTRIES = [
  { code: 'US' as const, flag: '🇺🇸', dial: '+1',  placeholder: '(555) 000-0000' },
  { code: 'MX' as const, flag: '🇲🇽', dial: '+52', placeholder: '55 0000 0000'  },
];
type CountryCode = typeof COUNTRIES[number]['code'];

const inputDark =
  'bg-white/10 border-white/20 text-white placeholder:text-white/35 focus-visible:border-white/50 focus-visible:ring-white/20';

export default function ReserveInquire() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vibe, setVibe] = useState<Vibe | ''>('');
  const [notes, setNotes] = useState('');
  const [country, setCountry] = useState<CountryCode>('US');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Please enter your name.' });
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast({
        variant: 'destructive',
        title: 'How should we reach you?',
        description: 'Add an email or phone number.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await submitToNetlifyForm('inquiry', {
        name: name.trim(),
        email: email.trim(),
        phone: `${COUNTRIES.find(c => c.code === country)!.dial} ${phone.trim()}`,
        vibe,
        notes: notes.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Inquiry submission failed:', err);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: 'Please try again or call us directly.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HeroBackdrop bgSrc={BG} overlayClassName="bg-black/45">
      <div className="flex min-h-screen items-start justify-center px-4 py-8 md:items-center">
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-black/55 p-8 text-white shadow-2xl backdrop-blur-2xl">

          {submitted ? (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <h1 className="text-2xl font-semibold">We'll be in touch.</h1>
              <p className="text-sm text-white/55">
                The Prestige team will reach out with options tailored to your trip.
              </p>
              <Button asChild variant="outline" className="mt-2 border-white/20 text-white hover:bg-white/10 hover:text-white">
                <Link to="/reserve">Back to start</Link>
              </Button>
            </div>
          ) : (
            <>
              <Link
                to="/reserve"
                className="inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Link>

              <div className="mt-5 mb-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-white/40">
                  Prestige Yachts Alliance · Cabo
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                  Ask a question.
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Tell us a bit — we'll suggest the right charter.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                {/* vibe picker */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-white/60">
                    Party size <span className="normal-case text-white/35">(optional)</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {VIBES.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVibe(vibe === v.value ? '' : v.value)}
                        className={cn(
                          'rounded-xl border px-3 py-2.5 text-left text-sm transition duration-150',
                          vibe === v.value
                            ? 'border-white/50 bg-white/20 text-white'
                            : 'border-white/15 bg-white/5 text-white/65 hover:border-white/30 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <p className="font-medium leading-none">{v.label}</p>
                        <p className="mt-0.5 text-[10px] text-white/45">{v.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inq-name" className="text-xs uppercase tracking-wider text-white/60">Name</Label>
                  <Input id="inq-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={inputDark} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inq-phone" className="text-xs uppercase tracking-wider text-white/60">Phone</Label>
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1 shrink-0">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setCountry(c.code)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 leading-none transition duration-150',
                            country === c.code
                              ? 'border-white/50 bg-white/20 text-white'
                              : 'border-white/15 bg-white/5 text-white/55 hover:border-white/30 hover:bg-white/10 hover:text-white/90'
                          )}
                        >
                          <span className="text-sm leading-none">{c.flag}</span>
                          <span className="text-[11px] font-medium">{c.dial}</span>
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40 select-none">
                        {COUNTRIES.find(c => c.code === country)!.dial}
                      </span>
                      <Input
                        id="inq-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={COUNTRIES.find(c => c.code === country)!.placeholder}
                        autoComplete="tel"
                        className={cn(inputDark, 'pl-12 h-full min-h-[40px]')}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inq-email" className="text-xs uppercase tracking-wider text-white/60">Email</Label>
                  <Input id="inq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={inputDark} />
                </div>
                <p className="-mt-2 text-[10px] text-white/35">Phone or email — either works.</p>

                <div className="space-y-1.5">
                  <Label htmlFor="inq-notes" className="text-xs uppercase tracking-wider text-white/60">
                    Anything else? <span className="normal-case text-white/35">(optional)</span>
                  </Label>
                  <Textarea
                    id="inq-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Dates, occasion, special requests…"
                    className={cn(inputDark, 'resize-none')}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Sending…' : 'Send inquiry'}
                </Button>

              </form>
            </>
          )}
        </div>
      </div>
    </HeroBackdrop>
  );
}
