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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { submitToNetlifyForm } from '@/lib/netlifyForms';
import { cn } from '@/lib/utils';

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
    imageClassName: 'scale-[1.43] origin-[center_65%] group-hover:scale-[1.47]',
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
            'h-1.5 rounded-full transition-all duration-300',
            n === step ? 'w-8 bg-gold' : n < step ? 'w-6 bg-gold/60' : 'w-6 bg-white/30'
          )}
        />
      ))}
      <span className="ml-2 text-xs font-medium uppercase tracking-[0.25em] text-white/70">
        Step {step} of {STEP_TOTAL}
      </span>
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
            experience.imageClassName ?? 'group-hover:scale-[1.03]'
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
  helper,
  value,
  onSelect,
  disabledMatcher,
}: {
  id: string;
  label: string;
  helper?: string;
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabledMatcher: (date: Date) => boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
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
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

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

  const datesValid =
    !!preferredDate &&
    !!backupDate &&
    !sameDay(preferredDate, backupDate);

  const stepTitle =
    step === 1
      ? 'Choose your experience'
      : step === 2
      ? 'Pick two dates that work'
      : 'How can we reach you?';
  const stepSubtitle =
    step === 1
      ? 'Tell us the kind of day you have in mind.'
      : step === 2
      ? 'A preferred date plus a backup gives us the most flexibility to lock you in.'
      : 'A quick call or text is the fastest way to confirm details and tailor your day.';

  const canContinue =
    (step === 1 && !!experienceId) || (step === 2 && datesValid);
  const canSubmit = !!name.trim() && !!phone.trim() && !submitting;

  const goNext = () => {
    if (!canContinue) return;
    setStep((s) => Math.min(STEP_TOTAL, s + 1) as Step);
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1) as Step);
  };

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
    setStep(1);
    setExperienceId(null);
    setPreferredDate(undefined);
    setBackupDate(undefined);
    setName('');
    setPhone('');
    setEmail('');
    setGuests('');
    setNotes('');
    setSubmitted(false);
  };

  return (
    <HeroBackdrop>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-6 md:py-8">
        <Link
          to="/reserve"
          className="inline-flex items-center gap-2 self-start text-sm text-white/80 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {submitted ? (
          <Card className="mt-6 border-emerald-500/40 bg-card/95 shadow-2xl backdrop-blur-xl">
            <CardContent className="space-y-4 p-8 text-center md:p-10">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="text-2xl font-semibold md:text-3xl">
                Thanks — we'll be in touch shortly.
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                A member of the Prestige Yachts team will reach out by phone to confirm
                your{' '}
                <span className="font-medium text-foreground">
                  {selectedExperience?.title.toLowerCase()}
                </span>{' '}
                and lock in the day. If you'd like to reach us first, call{' '}
                <span className="whitespace-nowrap font-medium text-foreground">
                  {RICARDO_PHONE_DISPLAY}
                </span>
                .
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button asChild variant="outline">
                  <Link to="/reserve">Back to start</Link>
                </Button>
                <Button onClick={resetFlow}>Submit another request</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mt-3 mb-4 text-white md:mt-4 md:mb-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 md:text-xs">
                Reserve your day
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">
                {stepTitle}
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-white/75 md:text-sm">
                {stepSubtitle}
              </p>
              <div className="mt-3">
                <StepIndicator step={step} />
              </div>
            </div>

            <Card className="border-white/30 bg-card/95 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-4 md:p-5">
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

                {step === 2 && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <DateField
                      id="preferred-date"
                      label="Preferred date"
                      helper="The day you'd most like to be on the water."
                      value={preferredDate}
                      onSelect={setPreferredDate}
                      disabledMatcher={(date) =>
                        date < today ||
                        (!!backupDate && sameDay(date, backupDate))
                      }
                    />
                    <DateField
                      id="backup-date"
                      label="Backup date"
                      helper="A second day that would also work for you."
                      value={backupDate}
                      onSelect={setBackupDate}
                      disabledMatcher={(date) =>
                        date < today ||
                        (!!preferredDate && sameDay(date, preferredDate))
                      }
                    />
                    {selectedExperience && (
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Selected experience
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {selectedExperience.title}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="lead-name">Your name</Label>
                      <Input
                        id="lead-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="lead-phone">Phone</Label>
                        <Input
                          id="lead-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1..."
                          autoComplete="tel"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lead-email">
                          Email <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="lead-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lead-guests">
                        Guests <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="lead-guests"
                        type="number"
                        min={1}
                        value={guests}
                        onChange={(e) => setGuests(e.target.value)}
                        placeholder="How many people?"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lead-notes">
                        Anything else?{' '}
                        <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="lead-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        placeholder="Special requests, occasion, dietary preferences..."
                      />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Your request
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-foreground">
                        <li>
                          <span className="font-medium">Experience:</span>{' '}
                          {selectedExperience?.title || '—'}
                        </li>
                        <li>
                          <span className="font-medium">Preferred:</span>{' '}
                          {preferredDate ? format(preferredDate, 'EEE, MMM d, yyyy') : '—'}
                        </li>
                        <li>
                          <span className="font-medium">Backup:</span>{' '}
                          {backupDate ? format(backupDate, 'EEE, MMM d, yyyy') : '—'}
                        </li>
                      </ul>
                    </div>
                  </form>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={goBack}
                    disabled={step === 1}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  {step < 3 ? (
                    <Button
                      type="button"
                      onClick={goNext}
                      disabled={!canContinue}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send request'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </HeroBackdrop>
  );
}
