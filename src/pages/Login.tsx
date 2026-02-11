import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "next-themes";

const BG_DESKTOP = "https://i.imgur.com/NcnnKgl.jpeg";
const BG_MOBILE = "https://i.imgur.com/fULRq0K.jpeg";
const BG_DARK = "https://i.imgur.com/IyexzYT.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signIn } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

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
      {/* Background image by theme */}
      {isDark ? (
        <img
          src={BG_DARK}
          alt="Luxury yacht background"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <>
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
        </>
      )}
      <div className={`absolute inset-0 ${isDark ? "bg-black/40" : "bg-black/25"}`} />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle buttonClassName="h-10 w-10 rounded-full border border-border/60 bg-card/70 backdrop-blur" />
      </div>

      {/* Login modal - centered on all devices */}
      <Card className="relative z-10 w-full max-w-md mx-4 border-border/50 shadow-2xl animate-fade-in bg-card">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Prestige Yachts Alliance</CardTitle>
          <p className="text-base font-semibold text-muted-foreground">Team Portal</p>
          <CardDescription className="text-sm text-muted-foreground">
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
