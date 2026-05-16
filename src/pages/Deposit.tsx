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
  const [yachtId, setYachtId] = useState<string>("");
  const [selection, setSelection] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: y }, { data: l }] = await Promise.all([
        supabase.from("yachts").select("id,name").order("name"),
        supabase.from("yacht_payment_links").select("*").order("duration_hours"),
      ]);
      setYachts((y ?? []) as Yacht[]);
      setLinks((l ?? []) as PaymentLink[]);
    })();
  }, []);

  const yachtLinks = useMemo(
    () => (yachtId ? links.filter((l) => l.yacht_id === yachtId) : []),
    [yachtId, links]
  );

  useEffect(() => {
    setSelection("");
  }, [yachtId]);

  const active = (() => {
    const link = yachtLinks.find((l) => l.id === selection);
    if (!link) return null;
    return {
      url: link.stripe_url,
      label: link.label || `${link.duration_hours}h Charter Payment`,
      amount: link.amount_usd != null ? Number(link.amount_usd) : null,
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
                    <SelectValue placeholder="Select a yacht" />
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
                <Label>Duration</Label>
                <Select
                  value={selection}
                  onValueChange={setSelection}
                  disabled={!yachtId || yachtLinks.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !yachtId
                          ? "Select a yacht first"
                          : yachtLinks.length === 0
                          ? "No payment links"
                          : "Select duration"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
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

            {yachtId && yachtLinks.length === 0 && (
              <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground text-center">
                No payment links are configured for this yacht yet. Please contact an admin
                to set them up under the yacht's Pricing &amp; Payments tab.
              </div>
            )}

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
