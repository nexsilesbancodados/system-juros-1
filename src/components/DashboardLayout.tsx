import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import GlobalSearch from "@/components/GlobalSearch";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();

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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: sidebar */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      )}

      <div className={`transition-all duration-300 ${isMobile ? "ml-0" : collapsed ? "ml-16" : "ml-60"}`}>
        <TopBar onSearchClick={() => setSearchOpen(true)} />
        <main className={`p-3 lg:p-6 animate-fade-in ${isMobile ? "pb-24" : ""}`}>
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
