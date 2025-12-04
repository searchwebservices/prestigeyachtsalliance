import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExternalLink, Shield, RefreshCw } from "lucide-react";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/7sY3cu0AL1eZ70Lg9Df3a01";

export default function Deposit() {
  const handlePayDeposit = () => {
    window.open(STRIPE_PAYMENT_LINK, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="container max-w-2xl py-12">
        <Card className="border-border/50">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">Charter Deposit</CardTitle>
            <CardDescription className="text-base">
              Secure your yacht charter reservation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">$500 USD</p>
              <p className="text-muted-foreground mt-1">Refundable Deposit</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Refundable Deposit</p>
                  <p className="text-sm text-muted-foreground">
                    Refunds are evaluated on a case-by-case basis. Acts of god (weather, natural disasters, etc.) are always fully refundable.
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
              onClick={handlePayDeposit} 
              className="w-full h-12 text-lg"
              size="lg"
            >
              Pay Deposit
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
