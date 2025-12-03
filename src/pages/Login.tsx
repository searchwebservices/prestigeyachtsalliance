import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import loginBg from "@/assets/login-bg.jpg";

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
    <div className="min-h-screen flex relative">
      {/* Background image - fullscreen on mobile, left half on desktop */}
      <div className="absolute inset-0 lg:relative lg:w-1/2 lg:flex-shrink-0">
        <img
          src={loginBg}
          alt="Luxury yacht in Los Cabos waters"
          className="absolute inset-0 w-full h-full object-cover object-[center_40%] lg:object-[center_30%]"
        />
        {/* Gradient overlay - darker at top for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/40 via-50% to-transparent" />
        
        {/* Branding - positioned at top 30% */}
        <div className="relative z-10 flex flex-col items-start p-8 pt-[20%] lg:p-12 lg:pt-[30%] h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <Anchor className="w-5 h-5 lg:w-6 lg:h-6 text-gold" />
            </div>
            <span className="text-xl lg:text-2xl font-semibold text-primary-foreground tracking-wide">
              Prestige Yachts Alliance
            </span>
          </div>
          <p className="text-primary-foreground/80 text-base lg:text-lg max-w-md hidden lg:block">
            Your exclusive portal to luxury yacht information, pricing, and availability in Los Cabos.
          </p>
        </div>
      </div>

      {/* Login form - overlay on mobile, right side on desktop */}
      <div className="relative z-20 flex-1 flex items-center justify-center p-6 lg:p-8 lg:bg-background min-h-screen">
        <Card className="w-full max-w-md border-border/50 shadow-xl lg:shadow-lg animate-fade-in bg-background/95 backdrop-blur-sm lg:bg-background lg:backdrop-blur-none">
          <CardHeader className="space-y-1 text-center">
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
