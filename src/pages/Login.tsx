import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BG_DESKTOP = "https://i.imgur.com/NcnnKgl.jpeg";
const BG_MOBILE = "https://i.imgur.com/fULRq0K.jpeg";

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
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Background images - mobile/tablet vs desktop */}
      <img
        src={BG_MOBILE}
        alt="Luxury yacht background"
        className="absolute inset-0 w-full h-full object-cover md:hidden"
      />
      <img
        src={BG_DESKTOP}
        alt="Luxury yacht background"
        className="absolute inset-0 w-full h-full object-cover hidden md:block"
      />

      {/* Login modal - centered on all devices */}
      <Card className="relative z-10 w-full max-w-md mx-4 border-border/50 shadow-2xl animate-fade-in bg-background/95 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Anchor className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">Prestige Yachts Alliance</span>
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
  );
}
