import {
  ClerkProvider,
  Show,
  SignIn,
  SignUp,
} from "@clerk/react";
import { ptBR } from "@clerk/localizations";
import {
  Redirect,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
} from "wouter";
import Chat from "./Chat";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY ausente.");
}

const clerkAppearance = {
  variables: {
    colorPrimary: "#10B981",
    colorForeground: "#0F1F1B",
    colorMutedForeground: "#56716A",
    colorDanger: "#EC4899",
    colorBackground: "#FFFFFF",
    colorInput: "#F5F8F7",
    colorInputForeground: "#0F1F1B",
    colorNeutral: "#D7E5E1",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    borderRadius: "14px",
  },
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/mascot.png`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: {
      background: "#FFFFFF",
      borderRadius: "20px",
      width: "min(420px, 100%)",
      overflow: "hidden",
      boxShadow:
        "0 24px 60px -20px rgba(15, 118, 110, 0.25), 0 4px 16px rgba(0,0,0,0.06)",
      border: "1px solid #E6F2EE",
    },
    card: {
      background: "transparent",
      boxShadow: "none",
      border: "none",
      padding: "28px 28px 18px",
    },
    footer: {
      background: "transparent",
      boxShadow: "none",
      border: "none",
      padding: "0 28px 22px",
    },
    logoBox: { justifyContent: "center", marginBottom: "10px" },
    logoImage: { height: "56px", width: "auto" },
    headerTitle: {
      fontSize: "22px",
      fontWeight: 700,
      color: "#0F766E",
      textAlign: "center",
    },
    headerSubtitle: {
      fontSize: "14px",
      color: "#56716A",
      textAlign: "center",
      marginTop: "6px",
    },
    socialButtonsBlockButton: {
      border: "1px solid #D7E5E1",
      borderRadius: "12px",
      background: "#FFFFFF",
      color: "#0F1F1B",
      fontWeight: 600,
      padding: "12px 14px",
    },
    socialButtonsBlockButtonText: {
      color: "#0F1F1B",
      fontWeight: 600,
      fontSize: "15px",
    },
    dividerLine: { background: "#E6F2EE" },
    dividerText: {
      color: "#56716A",
      fontSize: "12px",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    formFieldLabel: {
      color: "#0F1F1B",
      fontWeight: 600,
      fontSize: "13px",
    },
    formFieldInput: {
      background: "#F5F8F7",
      border: "1px solid #D7E5E1",
      borderRadius: "12px",
      padding: "12px 14px",
      color: "#0F1F1B",
      fontSize: "15px",
    },
    formButtonPrimary: {
      background: "#10B981",
      color: "#FFFFFF",
      borderRadius: "12px",
      padding: "12px 14px",
      fontWeight: 700,
      fontSize: "15px",
      boxShadow: "0 6px 16px -6px rgba(16,185,129,0.6)",
      textTransform: "none",
    },
    footerAction: { justifyContent: "center" },
    footerActionText: { color: "#56716A", fontSize: "14px" },
    footerActionLink: { color: "#0F766E", fontWeight: 700 },
    identityPreviewEditButton: { color: "#0F766E" },
    formFieldSuccessText: { color: "#10B981" },
    alert: {
      background: "#FFE0EC",
      border: "1px solid #F9A8D4",
      color: "#9D174D",
      borderRadius: "12px",
    },
    alertText: { color: "#9D174D" },
    otpCodeFieldInput: {
      background: "#F5F8F7",
      border: "1px solid #D7E5E1",
      color: "#0F1F1B",
    },
    formFieldRow: { gap: "10px" },
    main: { gap: "14px" },
  },
};

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-content">{children}</div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </AuthShell>
  );
}

function SignUpPage() {
  return (
    <AuthShell>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </AuthShell>
  );
}

function Landing() {
  const [, setLocation] = useLocation();
  return (
    <div className="landing">
      <div className="landing-card">
        <div className="welcome-blob" />
        <img
          src={`${import.meta.env.BASE_URL}mascot.png`}
          alt="Miar"
          className="welcome-mascot"
          draggable={false}
        />
        <h1 className="welcome-title">
          Oi! Eu sou a <span>Miar</span>
        </h1>
        <p className="welcome-sub">
          Sua IA de apoio operacional. Entre pra começar a conversar.
        </p>
        <button className="welcome-btn" onClick={() => setLocation("/sign-in")}>
          Entrar
        </button>
        <button
          className="welcome-link"
          onClick={() => setLocation("/sign-up")}
        >
          Ainda não tenho conta — criar agora
        </button>
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Chat />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={ptBR}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={basePath || "/"}
      signUpFallbackRedirectUrl={basePath || "/"}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
