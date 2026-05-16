import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Users, Activity, CalendarDays, MapPin, ShieldAlert } from "lucide-react"
import { CheckInButton } from "@/components/CheckInButton"
import { playGlobalAudio } from "@/components/FloatingPQRS"

const POEM_LINES = [
    "Podés elegir correr solo… o trabajar en equipo y llegar lejos.",
    "Que decís: Ir solo es más fácil, no tenés que ponerte de acuerdo con nadie.",
    "Si la pifiás, la pifiás solo. En equipo te digo… es a otro precio.",
    "Antes de empezar a competir… le tenés que ganar al ego más grande de todos, que es el tuyo.",
    "Tenés que entender que no solo está bien como vos lo hacés.",
    "Que hay otros caminos.",
    "Que si vas más rápido que el resto, es igual que si fueras el más lento de todos.",
    "Que para ser escuchado, primero tenés que haber oído.",
    "Para recibir un aplauso, tenés que estar golpeando tus propias palmas.",
    "Si no sabés cómo hacer algo bueno, te van a gritar, te van a gritar cómo hacerlo.",
    "Y si vas atrás, te van a empujar… y te van a empujar, hasta llevarte adelante.",
    "Si ganás, te van a apretar tan fuerte que vas a querer llorar.",
    "Porque cuando se juega en equipo… se celebra en equipo.",
]

export default function Home() {
    const navigate = useNavigate()
    const [isCheckInOpen, setIsCheckInOpen] = React.useState(false)

    React.useEffect(() => {
        // Try autoplay immediately; browsers may allow it silently
        playGlobalAudio()

        // Fallback: also hook first interaction in case browser blocked autoplay
        const handleFirstInteraction = () => {
            playGlobalAudio()
            window.removeEventListener("pointerdown", handleFirstInteraction)
            window.removeEventListener("keydown", handleFirstInteraction)
        }
        window.addEventListener("pointerdown", handleFirstInteraction)
        window.addEventListener("keydown", handleFirstInteraction)
        return () => {
            window.removeEventListener("pointerdown", handleFirstInteraction)
            window.removeEventListener("keydown", handleFirstInteraction)
        }
    }, [])

    return (
        <div className="min-h-screen text-foreground flex flex-col relative overflow-hidden">

            {/* ── Background Video ── */}
            <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster="/logo.png"
                className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none select-none"
                src="/Signo_opt.mp4"
            />

            {/* ── Dark overlay (so the video reads like a shadow behind UI) ── */}
            <div className="absolute inset-0 z-[1] bg-gradient-to-b from-zinc-950/85 via-zinc-950/75 to-zinc-950/90 pointer-events-none" />

            {/* ── Subtle glow accents (sit above overlay) ── */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] pointer-events-none z-[2]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-[2]" />

            {/* ── All content sits above overlay and glows ── */}
            <div className="flex-1 max-w-5xl mx-auto w-full p-6 flex flex-col justify-center relative z-10">

                {/* ── Hero ── */}
                <div className="text-center space-y-6 mb-16">
                    <img
                        src="/logo.png"
                        alt="PJR FC Logo"
                        className="h-40 w-40 mx-auto object-contain drop-shadow-[0_0_30px_rgba(188,158,98,0.6)] animate-pulse-slow"
                    />
                    <div className="space-y-2">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight bg-gradient-to-br from-[#bc9e62] via-[#e2cc98] to-[#9b7e45] bg-clip-text text-transparent drop-shadow-sm">
                            PJR FC
                        </h1>
                        <p className="text-lg md:text-xl text-primary/80 font-medium tracking-widest uppercase drop-shadow">
                            Portal Oficial del Equipo
                        </p>
                    </div>
                </div>

                {/* ── Check-in CTA ── */}
                <div className="flex justify-center mb-16">
                    <Button
                        onClick={() => setIsCheckInOpen(true)}
                        size="lg"
                        className="bg-primary text-zinc-950 font-black text-lg px-8 py-6 rounded-2xl hover:bg-primary/90 transition-all duration-300 shadow-[0_0_30px_rgba(188,158,98,0.35)] hover:shadow-[0_0_50px_rgba(188,158,98,0.55)] hover:scale-105"
                    >
                        <MapPin className="mr-3 h-6 w-6" />
                        REGISTRAR LLEGADA
                    </Button>
                </div>

                {/* ── Nav Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto">
                    {[
                        {
                            icon: <Users className="h-8 w-8 text-primary" />,
                            title: "Plantilla",
                            desc: "Estadísticas individuales, saldos, deudas y rendimiento de todos los jugadores.",
                            to: "/jugadores",
                        },
                        {
                            icon: <Activity className="h-8 w-8 text-primary" />,
                            title: "Matriz",
                            desc: "Tabla general de asistencias y participaciones en cada partido disputado.",
                            to: "/matriz",
                        },
                        {
                            icon: <CalendarDays className="h-8 w-8 text-primary" />,
                            title: "Partidos",
                            desc: "Calendario de encuentros, resultados y detalles de cada jornada.",
                            to: "/partidos",
                        },
                    ].map(({ icon, title, desc, to }) => (
                        <button
                            key={to}
                            onClick={() => navigate(to)}
                            className="group relative bg-zinc-950/70 backdrop-blur-md p-8 rounded-3xl border border-primary/20 hover:border-primary/60 transition-all duration-500 overflow-hidden text-left hover:-translate-y-2 shadow-lg"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="p-4 bg-primary/10 w-fit rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-500">
                                    {icon}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                        {title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Poem ── */}
            <div className="relative w-full max-w-2xl mx-auto mt-10 mb-4 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                    <span
                        className="text-white text-sm tracking-widest font-semibold whitespace-nowrap bg-zinc-950 px-4 py-1 rounded-full border border-primary/40"
                        style={{ fontFamily: "Georgia, serif" }}
                    >
                        — J. N. Pékerman
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                </div>

                <blockquote className="relative bg-zinc-950 border border-primary/30 rounded-3xl px-8 py-8 shadow-2xl shadow-black/80">
                    <span className="absolute -top-5 left-6 text-8xl text-primary font-serif leading-none select-none pointer-events-none bg-zinc-950 px-1">❝</span>

                    <div className="flex flex-col gap-3 relative z-10">
                        {POEM_LINES.map((line, i) => (
                            <p
                                key={i}
                                className={`leading-relaxed tracking-wide ${i === 0
                                        ? "text-primary font-bold text-base italic"
                                        : i === POEM_LINES.length - 1
                                            ? "text-primary font-bold italic text-base mt-3"
                                            : "text-white text-sm font-normal"
                                    }`}
                            >
                                {line}
                            </p>
                        ))}
                    </div>

                    <span className="absolute -bottom-5 right-6 text-8xl text-primary font-serif leading-none select-none rotate-180 pointer-events-none bg-zinc-950 px-1">❝</span>
                </blockquote>
            </div>

            {/* ── Admin link ── */}
            <div className="w-full p-4 flex justify-center pb-8 relative z-10">
                <Button
                    variant="ghost"
                    onClick={() => navigate("/admin")}
                    className="text-muted-foreground hover:text-primary/70 text-xs flex items-center gap-2 transition-colors"
                >
                    <ShieldAlert className="h-3 w-3" />
                    Acceso Administrativo
                </Button>
            </div>

            <CheckInButton open={isCheckInOpen} onOpenChange={setIsCheckInOpen} />
        </div>
    )
}
