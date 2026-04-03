import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import GlobalSearch from "@/components/GlobalSearch";
import { Outlet, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") setSearchOpen(false);
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
    <div className="min-h-screen bg-background">
      {/* Desktop: sidebar */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      )}

      <div className={`transition-all duration-300 ${isMobile ? "ml-0" : collapsed ? "ml-16" : "ml-56"}`}>
        <TopBar onSearchClick={() => setSearchOpen(true)} />
        {/* Improvement #15: Page transition animation on route change */}
        <main key={location.pathname} className={`p-3 lg:p-6 page-enter ${isMobile ? "pb-24" : ""}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile: bottom nav */}
      {isMobile && <MobileBottomNav />}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
