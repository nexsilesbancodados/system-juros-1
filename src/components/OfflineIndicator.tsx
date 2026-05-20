import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

const OfflineIndicator = () => {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 2500);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-2xl backdrop-blur-md border text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
        online
          ? "bg-success/15 border-success/40 text-success"
          : "bg-destructive/15 border-destructive/40 text-destructive"
      }`}
      role="status"
      aria-live="polite"
    >
      {online ? <Wifi size={13} /> : <WifiOff size={13} />}
      {online ? "Conexão restaurada" : "Você está offline — dados salvos disponíveis"}
    </div>
  );
};

export default OfflineIndicator;
