import { useState, useEffect, lazy, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Defer heavy overlays — they're only rendered after user interaction.
const GlobalSearch = lazy(() => import("@/components/GlobalSearch"));
const QuickPaymentModal = lazy(() => import("@/components/QuickPaymentModal"));
const KeyboardShortcutsHelp = lazy(() => import("@/components/KeyboardShortcutsHelp"));
const OnboardingTourAuto = lazy(() =>
  import("@/components/onboarding/OnboardingTour").then((m) => ({ default: m.OnboardingTourAuto }))
);

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  usePushNotifications();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const key = `__sub_checked_${user.id}`;
    if (sessionStorage.getItem(key)) return;

    (async () => {
      // Skip admins or check trial/subscription
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, trial_ends_at, email")
        .eq("id", user.id)
        .maybeSingle();

      const hasValidTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

      if (cancelled || profile?.is_admin || hasValidTrial) {
        sessionStorage.setItem(key, "1");
        return;
      }

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("email", profile?.email || user.email!)
        .maybeSingle();

      sessionStorage.setItem(key, "1");

      if (!cancelled && (!sub || sub.status !== 'active')) {
        const { data: settings } = await supabase
          .from("settings")
          .select("hubla_checkout_url")
          .eq("user_id", user.id)
          .maybeSingle();
        if (settings?.hubla_checkout_url) {
          toast({
            title: "Assinatura Requerida",
            description: "Seu teste grátis expirou. Redirecionando para o checkout...",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = settings.hubla_checkout_url;
          }, 3000);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPayOpen((prev) => !prev);
      }
      if (e.key === "Escape") { setSearchOpen(false); setPayOpen(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Improvement #14: Auto-collapse sidebar on small desktop screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1100 && !isMobile) setCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Static mesh gradients — no animation (animated blur is one of the heaviest paints). */}
      <div className="pointer-events-none absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[80px] -z-10" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[480px] h-[480px] bg-indigo-500/[0.03] rounded-full blur-[70px] -z-10" />

      {/* Desktop: sidebar */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      )}

      <div className={`transition-[margin] duration-300 ${isMobile ? "ml-0" : collapsed ? "ml-[72px]" : "ml-[260px]"}`}>
        <TopBar onSearchClick={() => setSearchOpen(true)} />
        <Breadcrumbs />
        <main className={`p-3 lg:p-6 ${isMobile ? "pb-24" : ""}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile: bottom nav */}
      {isMobile && <MobileBottomNav />}

      <Suspense fallback={null}>
        {searchOpen && <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}
        {payOpen && <QuickPaymentModal open={payOpen} onClose={() => setPayOpen(false)} />}
        <KeyboardShortcutsHelp />
        <OnboardingTourAuto />
      </Suspense>
    </div>
  );
};

export default DashboardLayout;
