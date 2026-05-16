import * as React from "react"
import { MessageSquare, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// ── Global audio singleton shared across all pages ──────────────────────────
let globalAudio: HTMLAudioElement | null = null

function getGlobalAudio() {
    if (!globalAudio) {
        globalAudio = new Audio("/simplemente.mp3")
        globalAudio.loop = true
        globalAudio.volume = 0.35
    }
    return globalAudio
}

// ── Expose mute state globally so Home.tsx can sync ──────────────────────────
let _setMutedCallback: ((v: boolean) => void) | null = null
export function setGlobalMuted(muted: boolean) {
    const audio = getGlobalAudio()
    audio.muted = muted
    if (_setMutedCallback) _setMutedCallback(muted)
}
export function isGlobalMuted() {
    return getGlobalAudio().muted
}
export function playGlobalAudio() {
    const audio = getGlobalAudio()
    audio.play().catch(() => {/* browser autoplay policy - ok */})
}

// ────────────────────────────────────────────────────────────────────────────

export function FloatingPQRS() {
    const [isOpen, setIsOpen] = React.useState(false)
    const [text, setText] = React.useState("")
    const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
    const [muted, setMuted] = React.useState(() => isGlobalMuted())

    // Keep ref to callback so global setter can update this component
    React.useEffect(() => {
        _setMutedCallback = setMuted
        return () => { _setMutedCallback = null }
    }, [])

    const toggleMute = () => {
        const next = !muted
        setGlobalMuted(next)
        setMuted(next)
        // If user just unmuted, try playing
        if (!next) playGlobalAudio()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!text.trim()) return

        setStatus("loading")
        try {
            const response = await fetch("/api/crud/pqrs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tipo: "general",
                    texto: text,
                    fecha: new Date().toISOString()
                })
            })

            if (response.ok) {
                setStatus("success")
                setTimeout(() => {
                    setIsOpen(false)
                    setText("")
                    setStatus("idle")
                }, 2000)
            } else {
                setStatus("error")
            }
        } catch (error) {
            console.error(error)
            setStatus("error")
        }
    }

    return (
        <>
            {/* ── Floating button group (mute + PQRS) ── */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">

                {/* Mute / Unmute button */}
                <button
                    onClick={toggleMute}
                    title={muted ? "Activar música" : "Silenciar música"}
                    className={`
                        h-10 w-10 rounded-full flex items-center justify-center
                        border transition-all duration-300 shadow-lg backdrop-blur-sm
                        ${muted
                            ? "bg-zinc-900/80 border-zinc-700/60 text-zinc-500 hover:text-primary hover:border-primary/40"
                            : "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 shadow-primary/20"}
                    `}
                >
                    {muted
                        ? <VolumeX className="h-4 w-4" />
                        : <Volume2 className="h-4 w-4" />
                    }
                </button>

                {/* PQRS button */}
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full bg-primary text-zinc-950 shadow-[0_0_20px_rgba(188,158,98,0.4)] hover:shadow-[0_0_30px_rgba(188,158,98,0.6)] hover:scale-110 transition-all duration-300 p-0"
                >
                    <MessageSquare className="h-6 w-6" />
                </Button>
            </div>

            {/* ── PQRS Dialog ── */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-primary/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-primary">Sugerencias y PQRS</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Envía tus peticiones, quejas, reclamos o sugerencias de forma totalmente anónima.
                        </DialogDescription>
                    </DialogHeader>

                    {status === "success" ? (
                        <div className="py-6 text-center text-green-400 font-bold flex flex-col items-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                <span className="text-2xl">✓</span>
                            </div>
                            Mensaje enviado exitosamente
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
                            <textarea
                                className="min-h-[150px] w-full rounded-xl border border-primary/20 bg-zinc-900 p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                placeholder="Escribe tu mensaje aquí..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                disabled={status === "loading"}
                                required
                            />

                            {status === "error" && (
                                <p className="text-red-400 text-xs">Error al enviar el mensaje. Inténtalo de nuevo.</p>
                            )}

                            <Button
                                type="submit"
                                className="w-full bg-primary text-zinc-950 font-bold hover:bg-primary/90"
                                disabled={status === "loading" || !text.trim()}
                            >
                                {status === "loading" ? "Enviando..." : "Enviar Mensaje Anónimo"}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
