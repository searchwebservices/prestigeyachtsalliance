import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HERO_IMAGE_URL = "https://i.imgur.com/iWjgotc.jpeg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Missing credentials",
        description: "Please enter both email and password.",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: "Invalid email or password. Please try again.",
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: "Welcome back",
      description: "Successfully signed in.",
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={HERO_IMAGE_URL}
          alt="Luxury yacht in Los Cabos waters"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/40" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <Anchor className="w-6 h-6 text-gold" />
            </div>
            <span className="text-2xl font-semibold text-primary-foreground tracking-wide">
              Prestige Yachts Alliance
            </span>
          </div>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Your exclusive portal to luxury yacht information, pricing, and availability in Los Cabos.
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-border/50 shadow-lg animate-fade-in">
          <CardHeader className="space-y-1 text-center">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Anchor className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-semibold text-foreground">Prestige Yachts</span>
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">Team Portal</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to access yacht information and availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-input focus:ring-ring"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-input focus:ring-ring"
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Contact your administrator if you need account access.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
