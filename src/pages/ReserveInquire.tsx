import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import HeroBackdrop from '@/components/reserve/HeroBackdrop';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { submitToNetlifyForm } from '@/lib/netlifyForms';

type Experience = 'fishing' | 'snorkel' | 'sunset' | 'celebration' | '';

const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: 'fishing', label: 'Fishing' },
  { value: 'snorkel', label: 'Snorkel' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'celebration', label: 'Special celebration' },
];

export default function ReserveInquire() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [guests, setGuests] = useState('');
  const [experience, setExperience] = useState<Experience>('');
  const [notes, setNotes] = useState('');
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
        description: 'Add an email or phone number so we can follow up.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitToNetlifyForm('inquiry', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        guests: guests.trim(),
        experience,
        notes: notes.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Inquiry submission failed:', err);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: 'Please try again, or call us directly.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HeroBackdrop>
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 md:px-6 md:py-14">
        <Link
          to="/reserve"
          className="inline-flex items-center gap-2 self-start text-sm text-white/80 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <Card className="mt-6 border-white/30 bg-card/95 shadow-2xl backdrop-blur-xl">
          {submitted ? (
            <CardContent className="space-y-4 p-8 text-center md:p-10">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="text-2xl font-semibold md:text-3xl">Thanks — we'll be in touch.</h1>
              <p className="text-sm text-muted-foreground md:text-base">
                A member of the Prestige Yachts team will reach out with options tailored to your day on
                the water.
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/reserve">Back to start</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl md:text-3xl">Tell us about your trip</CardTitle>
                <p className="text-sm text-muted-foreground md:text-base">
                  We'll respond with curated options that match the day you have in mind.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="inq-name">Your name</Label>
                    <Input
                      id="inq-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="inq-email">Email</Label>
                      <Input
                        id="inq-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inq-phone">Phone</Label>
                      <Input
                        id="inq-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1..."
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  <p className="-mt-3 text-xs text-muted-foreground">Email or phone — either is fine.</p>

                  <div className="space-y-2">
                    <Label htmlFor="inq-guests">
                      Guests <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="inq-guests"
                      type="number"
                      min={1}
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      placeholder="How many people?"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>
                      Experience <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <RadioGroup
                      value={experience}
                      onValueChange={(v) => setExperience(v as Experience)}
                      className="grid grid-cols-2 gap-2"
                    >
                      {EXPERIENCE_OPTIONS.map((opt) => (
                        <Label
                          key={opt.value}
                          htmlFor={`exp-${opt.value}`}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-accent/40"
                        >
                          <RadioGroupItem id={`exp-${opt.value}`} value={opt.value} />
                          <span>{opt.label}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inq-notes">
                      Anything else? <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="inq-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Special requests, occasion, dietary preferences..."
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send inquiry'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </HeroBackdrop>
  );
}
