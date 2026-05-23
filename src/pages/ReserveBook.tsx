import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Loader2,
  Star,
} from 'lucide-react';
import HeroBackdrop from '@/components/reserve/HeroBackdrop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { submitToNetlifyForm } from '@/lib/netlifyForms';
import { cn } from '@/lib/utils';

const BG =
  'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/65bcc876-2023-4b04-be2c-4d80958999e3/1778898862256-0.jpg';

type ExperienceId =
  | 'made-for-waves'
  | 'tu-enamorado'
  | 'dawn-patrol'
  | 'bad-romance';

type Experience = {
  id: ExperienceId;
  title: string;
  description: string;
  feature: string;
  socialProof: string;
  imageSrc: string;
  imageClassName?: string;
  imageHoverClassName?: string;
};

const EXPERIENCES: Experience[] = [
  {
    id: 'made-for-waves',
    title: 'Made for Waves',
    description:
      'Our flagship 48ft power catamaran — wide, fast, and built for groups who want space without sacrificing speed. Two hulls of stability for the Sea of Cortez at full tilt.',
    feature: '48ft Power Catamaran · Up to 16 guests',
    socialProof: 'From $2,650 USD per charter',
    imageSrc:
      'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/caa603fb-3eb4-409a-99eb-c41763c8f431/1764872659158.jpg',
  },
  {
    id: 'tu-enamorado',
    title: 'Tu Enamorado',
    description:
      'A one-of-a-kind 100ft wooden schooner — classic, cinematic, and unlike anything else in Cabo. Built for guests who want presence on the water: weddings, sunset cruises, corporate incentives, statement celebrations.',
    feature: '100ft Classic Wooden Schooner · Up to 35 guests',
    socialProof: 'Inquire for pricing',
    imageSrc:
      'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/e118183e-2e9d-4a7d-a322-8308aa6ac8d6/1778910496568-19.jpg',
    imageClassName: 'scale-[1.43] origin-[center_65%]',
    imageHoverClassName: 'md:group-hover:scale-[1.63]',
  },
  {
    id: 'dawn-patrol',
    title: 'Dawn Patrol',
    description:
      '65ft Sea Ray SuperSun Sport — two staterooms, full water toy kit (paddle board, floating mat, snorkel gear), open bar, and a chef on board serving fresh ceviche and seasonal fruit. The full-service day on the water.',
    feature: '65ft Sea Ray SuperSun Sport · Up to 24 guests',
    socialProof: 'From $600 USD per charter',
    imageSrc:
      'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/b3dd45cd-642f-4a69-a803-b78e62a2b35e/1778893540148-11.jpeg',
  },
  {
    id: 'bad-romance',
    title: 'Bad Romance',
    description:
      'A beautifully maintained Sea Ray Sundancer built for couples, small families, and groups who want the feel of a private Cabo charter without the super-yacht price tag. Intimate, stylish, easy.',
    feature: 'Sea Ray Sundancer · Up to 8 guests · 3hr minimum',
    socialProof: 'From $390 USD per charter',
    imageSrc:
      'https://uykzfpzawuyaroksyjsc.supabase.co/storage/v1/object/public/yacht-images/ea535126-2124-4844-a318-432d68e6f039/1778905315095-5.jpeg',
  },
];

const STEP_TOTAL = 3;
const RICARDO_PHONE_DISPLAY = '+52 624 266 4411';

type Step = 1 | 2 | 3;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            'h-1 rounded-full transition-all duration-300',
            n === step ? 'w-8 bg-white' : n < step ? 'w-6 bg-white/50' : 'w-6 bg-white/20'
          )}
        />
      ))}
    </div>
  );
}

function ExperienceCard({
  experience,
  selected,
  onSelect,
}: {
  experience: Experience;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative flex w-full overflow-hidden rounded-xl border-2 bg-card text-left shadow-md transition-all duration-300',
        'flex-row md:flex-col',
        'hover:shadow-xl md:hover:-translate-y-0.5',
        selected
          ? 'border-gold shadow-gold ring-2 ring-gold/40'
          : 'border-border/60 hover:border-gold/60'
      )}
    >
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-muted',
          'aspect-square w-24 sm:w-28',
          'md:aspect-[4/3] md:w-full'
        )}
      >
        <img
          src={experience.imageSrc}
          alt=""
          className={cn(
            'h-full w-full object-cover object-center transition-transform duration-500',
            experience.imageClassName,
            experience.imageHoverClassName ?? 'md:group-hover:scale-[1.2]',
            !experience.imageClassName && selected && 'max-md:scale-[1.12]'
          )}
        />
        {selected && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-foreground shadow-lg md:h-7 md:w-7">
            <Check className="h-3 w-3 md:h-3.5 md:w-3.5" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 md:gap-1.5 md:p-3.5">
        <h3 className="text-sm font-semibold leading-tight text-foreground md:text-base">
          {experience.title}
        </h3>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
          {experience.description}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gold md:text-[11px]">
          {experience.feature}
        </p>
        <div className="mt-auto flex items-center gap-1.5 pt-0.5">
          <div className="flex items-center text-gold" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-2.5 w-2.5 fill-gold md:h-3 md:w-3" />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground md:text-[11px]">
            {experience.socialProof}
          </span>
        </div>
      </div>
    </button>
  );
}

function DateField({
  id,
  label,
  value,
  onSelect,
  disabledMatcher,
}: {
  id: string;
  label: string;
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabledMatcher: (date: Date) => boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-white/70 text-xs uppercase tracking-wider">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal border-white/20 bg-white/10 hover:bg-white/15 hover:border-white/35',
              value ? 'text-white' : 'text-white/40'
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            {value ? format(value, 'EEEE, MMMM d, yyyy') : 'Select a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onSelect}
            disabled={disabledMatcher}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

const inputDark = 'bg-white/10 border-white/20 text-white placeholder:text-white/35 focus-visible:border-white/50 focus-visible:ring-white/20';

export default function ReserveBook() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [experienceId, setExperienceId] = useState<ExperienceId | null>(null);

  useEffect(() => {
    const yachtParam = searchParams.get('yacht') as ExperienceId | null;
    if (yachtParam && EXPERIENCES.some((e) => e.id === yachtParam)) {
      setExperienceId(yachtParam);
      setStep(2);
    }
  }, []);

  const [preferredDate, setPreferredDate] = useState<Date | undefined>(undefined);
  const [backupDate, setBackupDate] = useState<Date | undefined>(undefined);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guests, setGuests] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const today = useMemo(() => startOfToday(), []);
  const selectedExperience = useMemo(
    () => EXPERIENCES.find((e) => e.id === experienceId) || null,
    [experienceId]
  );

  const datesValid = !!preferredDate && !!backupDate && !sameDay(preferredDate, backupDate);
  const canContinue = (step === 1 && !!experienceId) || (step === 2 && datesValid);
  const canSubmit = !!name.trim() && !!phone.trim() && !submitting;

  const goNext = () => { if (canContinue) setStep((s) => Math.min(STEP_TOTAL, s + 1) as Step); };
  const goBack = () => { setStep((s) => Math.max(1, s - 1) as Step); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedExperience || !preferredDate || !backupDate) return;
    setSubmitting(true);
    try {
      await submitToNetlifyForm('reservation_lead', {
        experience_id: selectedExperience.id,
        experience_title: selectedExperience.title,
        preferred_date: format(preferredDate, 'yyyy-MM-dd'),
        backup_date: format(backupDate, 'yyyy-MM-dd'),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        guests: guests.trim(),
        notes: notes.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Reservation lead submission failed:', err);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: `Please try again, or call us at ${RICARDO_PHONE_DISPLAY}.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep(1); setExperienceId(null); setPreferredDate(undefined); setBackupDate(undefined);
    setName(''); setPhone(''); setEmail(''); setGuests(''); setNotes(''); setSubmitted(false);
  };

  return (
    <HeroBackdrop bgSrc={BG} overlayClassName="bg-black/45">
      <div className="flex min-h-screen items-start justify-center px-4 py-8 md:items-center">

        {submitted ? (
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/55 px-8 py-10 text-center text-white shadow-2xl backdrop-blur-2xl">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h1 className="mt-4 text-2xl font-semibold">We're on it.</h1>
            <p className="mt-2 text-sm text-white/60">
              The Prestige team will reach out to confirm your{' '}
              <span className="font-medium text-white">{selectedExperience?.title}</span> charter.
              Questions? Call{' '}
              <span className="font-medium text-white">{RICARDO_PHONE_DISPLAY}</span>.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">
                <Link to="/reserve">Back to start</Link>
              </Button>
              <Button variant="ghost" className="text-white/55 hover:text-white hover:bg-white/10" onClick={resetFlow}>
                Submit another
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl rounded-3xl border border-white/20 bg-black/55 p-6 text-white shadow-2xl backdrop-blur-2xl md:p-8">

            {/* header row */}
            <div className="flex items-center justify-between">
              <Link
                to="/reserve"
                className="inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Link>
              <StepIndicator step={step} />
            </div>

            {/* step label + title */}
            <div className="mt-5 mb-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-white/40">
                Step {step} of {STEP_TOTAL}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                {step === 1 ? 'Pick a yacht.' : step === 2 ? 'Two dates.' : 'Your contact.'}
              </h1>
              {step === 2 && (
                <p className="mt-1 text-sm text-white/50">
                  Preferred + a backup so we have room to lock you in.
                </p>
              )}
              {step === 3 && (
                <p className="mt-1 text-sm text-white/50">
                  A quick call is all it takes to confirm.
                </p>
              )}
            </div>

            {/* ── Step 1: yacht cards ── */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
                {EXPERIENCES.map((exp) => (
                  <ExperienceCard
                    key={exp.id}
                    experience={exp}
                    selected={experienceId === exp.id}
                    onSelect={() => setExperienceId(exp.id)}
                  />
                ))}
              </div>
            )}

            {/* ── Step 2: dates ── */}
            {step === 2 && (
              <div className="mx-auto max-w-lg space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <DateField
                    id="preferred-date"
                    label="Preferred date"
                    value={preferredDate}
                    onSelect={setPreferredDate}
                    disabledMatcher={(date) =>
                      date < today || (!!backupDate && sameDay(date, backupDate))
                    }
                  />
                  <DateField
                    id="backup-date"
                    label="Backup date"
                    value={backupDate}
                    onSelect={setBackupDate}
                    disabledMatcher={(date) =>
                      date < today || (!!preferredDate && sameDay(date, preferredDate))
                    }
                  />
                </div>
                {selectedExperience && (
                  <p className="text-xs text-white/40">
                    Yacht: <span className="text-white/70">{selectedExperience.title}</span>
                  </p>
                )}
              </div>
            )}

            {/* ── Step 3: contact ── */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name" className="text-xs uppercase tracking-wider text-white/70">Name</Label>
                  <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={inputDark} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-phone" className="text-xs uppercase tracking-wider text-white/70">Phone</Label>
                    <Input id="lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." autoComplete="tel" required className={inputDark} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-email" className="text-xs uppercase tracking-wider text-white/70">Email <span className="normal-case text-white/35">(optional)</span></Label>
                    <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={inputDark} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-guests" className="text-xs uppercase tracking-wider text-white/70">Guests <span className="normal-case text-white/35">(optional)</span></Label>
                    <Input id="lead-guests" type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="How many?" className={inputDark} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-notes" className="text-xs uppercase tracking-wider text-white/70">Notes <span className="normal-case text-white/35">(optional)</span></Label>
                    <Input id="lead-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Occasion, requests…" className={inputDark} />
                  </div>
                </div>

                {/* summary */}
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50 space-y-0.5">
                  <p><span className="text-white/30">Yacht</span> {selectedExperience?.title ?? '—'}</p>
                  <p><span className="text-white/30">Preferred</span> {preferredDate ? format(preferredDate, 'EEE, MMM d') : '—'}</p>
                  <p><span className="text-white/30">Backup</span> {backupDate ? format(backupDate, 'EEE, MMM d') : '—'}</p>
                </div>
              </form>
            )}

            {/* nav */}
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={step === 1}
                className="text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-0"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={goNext} disabled={!canContinue}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Sending…' : 'Send request'}
                </Button>
              )}
            </div>

          </div>
        )}
      </div>
    </HeroBackdrop>
  );
}
