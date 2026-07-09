import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onTranscribed: (text: string) => void;
  size?: "sm" | "icon";
  className?: string;
  title?: string;
}

/**
 * Gravador de áudio que envia PCM/WAV pra edge function `transcribe-audio`
 * (Lovable AI Gateway → gpt-4o-transcribe) e devolve o texto via callback.
 */
export default function VoiceRecorder({ onTranscribed, size = "icon", className, title = "Gravar nota de voz" }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];
      node.onaudioprocess = (e) => chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      src.connect(node);
      node.connect(ctx.destination);
      srcRef.current = src;
      nodeRef.current = node;
      setRecording(true);
    } catch (e) {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stop = async () => {
    setRecording(false);
    const ctx = ctxRef.current;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    nodeRef.current?.disconnect();
    srcRef.current?.disconnect();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const chunks = chunksRef.current;
    await ctx.close();

    const wav = encodeWav(chunks, sampleRate);
    if (wav.size < 2048) {
      toast.error("Gravação muito curta");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", wav, "recording.wav");
      const { data, error } = await supabase.functions.invoke("transcribe-audio", { body: fd });
      if (error) throw error;
      const text = (data as any)?.text?.trim();
      if (!text) throw new Error("Sem texto reconhecido");
      onTranscribed(text);
      toast.success("Áudio transcrito");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao transcrever");
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => (recording ? stop() : start());

  return (
    <Button
      type="button"
      size={size}
      variant={recording ? "destructive" : "outline"}
      className={className}
      onClick={toggle}
      disabled={busy}
      title={title}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}

// -------- WAV encoding (16-bit mono, downsampled to 16 kHz) --------
function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const merged = flatten(chunks);
  const target = 16000;
  const resampled = sampleRate === target ? merged : downsample(merged, sampleRate, target);
  const buffer = new ArrayBuffer(44 + resampled.length * 2);
  const view = new DataView(buffer);
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + resampled.length * 2, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, "data");
  view.setUint32(40, resampled.length * 2, true);
  let offset = 44;
  for (let i = 0; i < resampled.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
function flatten(chunks: Float32Array[]): Float32Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
function downsample(buf: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return buf;
  const ratio = from / to;
  const outLen = Math.round(buf.length / ratio);
  const out = new Float32Array(outLen);
  let iOut = 0, iIn = 0;
  while (iOut < outLen) {
    const next = Math.round((iOut + 1) * ratio);
    let sum = 0, count = 0;
    for (; iIn < next && iIn < buf.length; iIn++) { sum += buf[iIn]; count++; }
    out[iOut++] = count ? sum / count : 0;
  }
  return out;
}
function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
