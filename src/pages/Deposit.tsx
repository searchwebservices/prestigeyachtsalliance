import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExternalLink, Shield, RefreshCw } from "lucide-react";

const FALLBACK_STANDARD_URL = "https://buy.stripe.com/7sY3cu0AL1eZ70Lg9Df3a01";
const STANDARD_KEY = "__standard__";

interface Yacht {
  id: string;
  name: string;
}

interface PaymentLink {
  id: string;
  yacht_id: string;
  duration_hours: number;
  label: string | null;
  amount_usd: number | null;
  stripe_url: string;
}

export default function Deposit() {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [standardUrl, setStandardUrl] = useState<string>(FALLBACK_STANDARD_URL);
  const [yachtId, setYachtId] = useState<string>("");
  const [selection, setSelection] = useState<string>(STANDARD_KEY);

  useEffect(() => {
    (async () => {
      const [{ data: y }, { data: l }, { data: s }] = await Promise.all([
        supabase.from("yachts").select("id,name").order("name"),
        supabase.from("yacht_payment_links").select("*").order("duration_hours"),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "standard_deposit_stripe_url")
          .maybeSingle(),
      ]);
      setYachts((y ?? []) as Yacht[]);
      setLinks((l ?? []) as PaymentLink[]);
      if (s?.value) setStandardUrl(s.value);
    })();
  }, []);

  const yachtLinks = useMemo(
    () => (yachtId ? links.filter((l) => l.yacht_id === yachtId) : []),
    [yachtId, links]
  );

  // Reset selection when changing yacht
  useEffect(() => {
    setSelection(STANDARD_KEY);
  }, [yachtId]);

  const active =
    selection === STANDARD_KEY
      ? {
          url: standardUrl,
          label: "Refundable Deposit",
          amount: 500,
          isStandard: true,
        }
      : (() => {
          const link = yachtLinks.find((l) => l.id === selection);
          if (!link) return null;
          return {
            url: link.stripe_url,
            label: link.label || `${link.duration_hours}h Charter Payment`,
            amount: link.amount_usd != null ? Number(link.amount_usd) : null,
            isStandard: false,
          };
        })();

  const handlePay = () => {
    if (active?.url) window.open(active.url, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="container max-w-2xl py-12">
        <Card className="border-border/50">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">Charter Payment</CardTitle>
            <CardDescription className="text-base">
              Secure your yacht charter reservation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Yacht</Label>
                <Select value={yachtId} onValueChange={setYachtId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any yacht (standard deposit)" />
                  </SelectTrigger>
                  <SelectContent>
                    {yachts.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment option</Label>
                <Select value={selection} onValueChange={setSelection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STANDARD_KEY}>
                      Standard $500 USD deposit
                    </SelectItem>
                    {yachtLinks.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.duration_hours}h
                        {l.label ? ` — ${l.label}` : ""}
                        {l.amount_usd != null
                          ? ` ($${Number(l.amount_usd).toLocaleString()} USD)`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {active && (
              <div className="text-center pt-2">
                <p className="text-5xl font-bold text-primary">
                  {active.amount != null
                    ? `$${active.amount.toLocaleString()} USD`
                    : "Pay"}
                </p>
                <p className="text-muted-foreground mt-1">{active.label}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Refund policy</p>
                  <p className="text-sm text-muted-foreground">
                    Refunds are evaluated on a case-by-case basis. Acts of god
                    (weather, natural disasters, etc.) are always fully refundable.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <RefreshCw className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Secure Payment</p>
                  <p className="text-sm text-muted-foreground">
                    Payments are securely processed through Stripe.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handlePay}
              className="w-full h-12 text-lg"
              size="lg"
              disabled={!active?.url}
            >
              Pay Now
              <ExternalLink className="ml-2 h-5 w-5" />
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You will be redirected to Stripe's secure checkout page.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
