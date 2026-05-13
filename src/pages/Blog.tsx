import { useState } from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import { BookOpen, Search } from "lucide-react";
import { motion } from "framer-motion";

const categories = [
  { name: "Todos", count: 42 },
  { name: "Investimentos", count: 12 },
  { name: "Empresarial", count: 9 },
  { name: "Crédito", count: 8 },
  { name: "Planejamento", count: 7 },
  { name: "Educação", count: 6 },
];

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState("Todos");

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20">
      <LandingNavbar />
      
      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        {/* Edition Label */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 mb-12"
        >
          <div className="h-px w-12 bg-white/20" />
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-medium text-white/60">
            <BookOpen size={12} />
            EDIÇÃO #28 • MAIO 2026
          </div>
          <div className="h-px w-12 bg-white/20" />
        </motion.div>

        {/* Hero Section */}
        <div className="relative flex flex-col md:flex-row items-center justify-center mb-20">
          {/* Left Description */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="md:absolute left-0 top-1/2 -translate-y-1/2 max-w-[200px] text-[10px] leading-relaxed text-white/50 uppercase tracking-widest hidden lg:block"
          >
            <div className="h-px w-8 bg-white/40 mb-4" />
            Análises, ensaios e curadoria sobre crédito, investimentos e o futuro do dinheiro escritos pela nossa mesa.
          </motion.div>

          {/* Overlapping Titles */}
          <div className="relative isolate">
            <motion.h1 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-8xl md:text-[12rem] font-serif leading-none tracking-tighter relative z-10"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Diário
            </motion.h1>
            <motion.span
              initial={{ opacity: 0, scale: 1.5, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="absolute top-1/2 left-1/2 -translate-x-3/4 -translate-y-1/2 text-[15rem] md:text-[25rem] font-serif italic text-[#c5a358]/60 leading-none select-none z-0 pointer-events-none"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              F
            </motion.span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/10 pt-10">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`group flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
                  activeCategory === cat.name
                    ? "bg-[#c5a358] border-[#c5a358] text-black"
                    : "bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                }`}
              >
                {cat.name}
                <span className={`text-[10px] ${activeCategory === cat.name ? "text-black/60" : "text-white/20 group-hover:text-white/40"}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/60 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar artigos..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-6 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
            />
          </div>
        </div>

        {/* Empty State / Grid Placeholder */}
        <div className="mt-20 text-center py-20 border border-dashed border-white/10 rounded-3xl">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="text-white/20" />
          </div>
          <h3 className="text-xl font-display font-medium text-white/80">Nenhum artigo publicado ainda</h3>
          <p className="text-sm text-white/40 mt-2">Nossa equipe está preparando conteúdos exclusivos para você.</p>
        </div>
      </main>
    </div>
  );
};

export default Blog;
