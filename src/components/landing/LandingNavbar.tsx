import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import eagleLogo from "@/assets/eagle-logo.webp";

const LandingNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { config } = useWhiteLabel();

  const logoSrc = config.companyLogo || eagleLogo;
  const brandTitle = config.companyName || "CREDMAIS APP";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Início", href: "#home" },
    { name: "Recursos", href: "#features" },
    { name: "Benefícios", href: "#benefits" },
    { name: "Planos", href: "/planos", internal: true },
    { name: "Contato", href: "#contact" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-black/60 backdrop-blur-xl py-3 shadow-lg border-b border-white/5" : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <img src={logoSrc} alt={brandTitle} className="w-10 h-10 rounded-full" />
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-widest text-gradient-gold leading-none">
              {brandTitle}
            </span>
            <span className="text-[8px] text-white/40 tracking-[0.2em] uppercase mt-0.5">
              Sistema de Gestão
            </span>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            link.internal ? (
              <Link
                key={link.name}
                to={link.href}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                {link.name}
              </Link>
            ) : (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                {link.name}
              </a>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Entrar
          </Link>
          <Link
            to="/login?plan=trial"
            className="px-6 py-2.5 rounded-full text-sm font-bold bg-white text-black hover:bg-white/90 transition-all shadow-lg shadow-white/10"
          >
            TESTE GRÁTIS
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black/95 border-b border-white/10 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-6">
              {navLinks.map((link) => (
                link.internal ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-lg font-medium text-white/70"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-lg font-medium text-white/70"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                )
              ))}
              <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
                <Link
                  to="/login"
                  className="text-center py-3 text-white/70 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  to="/login?plan=trial"
                  className="text-center py-3 rounded-xl bg-white text-black font-bold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  TESTE GRÁTIS
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default LandingNavbar;
