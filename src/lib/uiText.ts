import type { AppLanguage } from "@/contexts/LanguageContext";

export const uiText: Record<
  AppLanguage,
  {
    yachts: string;
    book: string;
    calendar: string;
    team: string;
    settings: string;
    signOut: string;
    teamPortal: string;
    email: string;
    password: string;
    signIn: string;
    signingIn: string;
    loginDescription: string;
    missingCredentialsTitle: string;
    missingCredentialsDescription: string;
    authFailedTitle: string;
    authFailedDescription: string;
    welcomeBackTitle: string;
    welcomeBackDescription: string;
    contactAdmin: string;
    profile: string;
  }
> = {
  en: {
    yachts: "Yachts",
    book: "Book",
    calendar: "Calendar",
    team: "Team",
    settings: "Settings",
    signOut: "Sign out",
    teamPortal: "Team Portal",
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    signingIn: "Signing in...",
    loginDescription: "Sign in to access yacht information and availability",
    missingCredentialsTitle: "Missing credentials",
    missingCredentialsDescription: "Please enter both email and password.",
    authFailedTitle: "Authentication failed",
    authFailedDescription: "Invalid email or password. Please try again.",
    welcomeBackTitle: "Welcome back",
    welcomeBackDescription: "Successfully signed in.",
    contactAdmin: "Contact your administrator if you need account access.",
    profile: "Profile",
  },
  es: {
    yachts: "Yates",
    book: "Reservar",
    calendar: "Calendario",
    team: "Equipo",
    settings: "Configuración",
    signOut: "Cerrar sesión",
    teamPortal: "Portal del equipo",
    email: "Correo electrónico",
    password: "Contraseña",
    signIn: "Iniciar sesión",
    signingIn: "Iniciando sesión...",
    loginDescription: "Inicia sesión para acceder a información y disponibilidad de yates",
    missingCredentialsTitle: "Faltan credenciales",
    missingCredentialsDescription: "Ingresa correo electrónico y contraseña.",
    authFailedTitle: "Autenticación fallida",
    authFailedDescription: "Correo o contraseña inválidos. Intenta de nuevo.",
    welcomeBackTitle: "Bienvenido de nuevo",
    welcomeBackDescription: "Inicio de sesión exitoso.",
    contactAdmin: "Contacta a tu administrador si necesitas acceso.",
    profile: "Perfil",
  },
};
