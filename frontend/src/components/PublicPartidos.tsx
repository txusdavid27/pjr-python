import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
    Calendar, ChevronLeft, Clock, Trophy, Edit,
    LogIn, LogOut, ShieldCheck, MapPin, UserCheck, RefreshCw,
    Goal, CheckCircle2, Star, Dumbbell
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { LoginModal } from "@/components/LoginModal"
import { useAuth } from "@/contexts/AuthContext"

interface Partido {
    id: number
    orden: number
    nombre_rival: string
    dia: string
    mes: string
    hora: string
    local: string
    goles_pjr: string | number
    goles_rival: string | number
    escudo?: string
    asistencia?: any[]
    tipo?: string         // "partido" | "entrenamiento"
    terminado?: boolean
    fairplay_override?: number | null
}

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function parseMatchDate(dia: string, mes: string): Date | null {
    if (!dia || !mes) return null
    const m = MONTHS.findIndex(x => x.toLowerCase() === mes.toLowerCase())
    if (m === -1) return null
    const d = parseInt(dia, 10)
    if (isNaN(d)) return null
    return new Date(new Date().getFullYear(), m, d)
}

export default function PublicPartidos() {
    const navigate = useNavigate()
    const { isAdmin, adminLogin, adminLogout } = useAuth()

    const [showLogin, setShowLogin] = React.useState(false)

    const handleLoginSuccess = (token: string) => {
        adminLogin(token)
    }
    const handleLogout = () => {
        adminLogout()
    }

    // ── Data ────────────────────────────────────────────────
    const [partidos, setPartidos] = React.useState<Partido[]>([])
    const [players, setPlayers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    const loadData = React.useCallback(() => {
        setLoading(true)
        Promise.all([
            fetch("/api/crud/partido").then(r => r.json()),
            fetch("/api/crud/jugador").then(r => r.json()),
        ]).then(([partidoData, jugadorData]) => {
            const now = new Date()
            const sorted = [...partidoData].sort((a: Partido, b: Partido) => {
                const dA = parseMatchDate(a.dia, a.mes)
                const dB = parseMatchDate(b.dia, b.mes)
                if (!dA && !dB) return (a.orden || 0) - (b.orden || 0)
                if (!dA) return 1
                if (!dB) return -1
                return Math.abs(dA.getTime() - now.getTime()) - Math.abs(dB.getTime() - now.getTime())
            })
            setPartidos(sorted)
            setPlayers(jugadorData.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")))
            setLoading(false)
        }).catch(err => { console.error(err); setLoading(false) })
    }, [])

    React.useEffect(() => { loadData() }, [loadData])

    // ── Admin Edit ──────────────────────────────────────────
    const [editingMatch, setEditingMatch] = React.useState<Partido | null>(null)
    const [editForm, setEditForm] = React.useState({ dia: "", mes: "", hora: "", local: "" })
    const [editSaving, setEditSaving] = React.useState(false)

    const openEdit = (p: Partido, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingMatch(p)
        setEditForm({ dia: p.dia || "", mes: p.mes || "", hora: p.hora || "", local: p.local || "" })
    }

    const handleEditSave = async () => {
        if (!editingMatch) return
        setEditSaving(true)
        try {
            await fetch(`/api/crud/partido/${editingMatch.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...editingMatch, ...editForm }),
            })
            setEditingMatch(null)
            loadData()
        } catch (e) { console.error(e) }
        setEditSaving(false)
    }

    // ── Score editing ─────────────────────────────────────────────────────────────────────────
    const [scoreMatch, setScoreMatch] = React.useState<Partido | null>(null)
    const [scoreForm, setScoreForm] = React.useState({ goles_pjr: "", goles_rival: "" })
    const [scoreSaving, setScoreSaving] = React.useState(false)

    const openScore = (p: Partido, e: React.MouseEvent) => {
        e.stopPropagation()
        setScoreMatch(p)
        setScoreForm({
            goles_pjr: String(p.goles_pjr ?? ""),
            goles_rival: String(p.goles_rival ?? "")
        })
    }

    const handleScoreSave = async (markFinished = false) => {
        if (!scoreMatch) return
        setScoreSaving(true)
        try {
            await fetch(`/api/crud/partido/${scoreMatch.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...scoreMatch,
                    goles_pjr: scoreForm.goles_pjr,
                    goles_rival: scoreForm.goles_rival,
                    terminado: markFinished ? true : scoreMatch.terminado ?? false,
                }),
            })
            setScoreMatch(null)
            loadData()
        } catch (e) { console.error(e) }
        setScoreSaving(false)
    }

    // ── Fair Play ──────────────────────────────────────────────────────────────────────────────────────
    const [amonestaciones, setAmonestaciones] = React.useState<any[]>([])
    const [fairplayOverride, setFairplayOverride] = React.useState<string>("")
    const [fpSaving, setFpSaving] = React.useState(false)
    const [fpStatus, setFpStatus] = React.useState("")
    const [showFairplay, setShowFairplay] = React.useState(false)

    React.useEffect(() => {
        fetch("/api/crud/amonestacion")
            .then(r => r.json())
            .then(d => setAmonestaciones(Array.isArray(d) ? d : []))
            .catch(() => {})
    }, [])

    const fairplayCalc = React.useMemo(() => {
        const amarillas = amonestaciones.filter(a => a.tipo === "amarilla").length
        const rojas = amonestaciones.filter(a => a.tipo === "roja").length
        const penalizaciones = amonestaciones
            .filter(a => a.tipo === "fairplay")
            .reduce((sum, a) => sum + (Number(a.valor) || 0), 0)

        // +10 per finished match with NO cards in that match
        const partidosFinished = partidos.filter(p => p.terminado)
        const partidosLimpios = partidosFinished.filter(p => {
            const amonesPart = amonestaciones.filter(
                a => String(a.partido_id) === String(p.id) &&
                     (a.tipo === "amarilla" || a.tipo === "roja")
            )
            return amonesPart.length === 0
        }).length

        return {
            base: 1000,
            amarillas,
            rojas,
            limpios: partidosLimpios,
            penalizaciones,
            calculado: 1000 - amarillas * 10 - rojas * 30 + partidosLimpios * 10 + penalizaciones,
        }
    }, [amonestaciones, partidos])

    const fairplayFinal = React.useMemo(() => {
        const override = partidos.find(p => p.fairplay_override != null)?.fairplay_override
        if (override != null && Number(override) < fairplayCalc.calculado) {
            return Number(override)
        }
        return fairplayCalc.calculado
    }, [fairplayCalc, partidos])

    const handleFairplaySave = async () => {
        const val = Number(fairplayOverride)
        if (isNaN(val) || val >= fairplayCalc.calculado) {
            setFpStatus("⚠️ Solo puedes bajar el valor calculado (" + fairplayCalc.calculado + ").")
            return
        }
        setFpSaving(true)
        try {
            // Store override on the first partido as a global setting
            const first = partidos[0]
            if (!first) return
            await fetch(`/api/crud/partido/${first.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...first, fairplay_override: val }),
            })
            setFpStatus("✅ Guardado.")
            loadData()
        } catch { setFpStatus("❌ Error.") }
        setFpSaving(false)
    }

    // ── User Action Modal ───────────────────────────────────
    const [actionMatch, setActionMatch] = React.useState<Partido | null>(null)
    const [actionTab, setActionTab] = React.useState<"asistencia" | "aplazamiento">("asistencia")
    const [attendanceForm, setAttendanceForm] = React.useState({ nombre: "", estado: "asiste" })
    const [aplazamientoText, setAplazamientoText] = React.useState("")
    const [actionStatus, setActionStatus] = React.useState("")

    const openAction = (p: Partido) => {
        if (isAdmin) return  // admins click the edit btn, not the card
        setActionMatch(p)
        setActionTab("asistencia")
        setActionStatus("")
        setAttendanceForm({ nombre: "", estado: "asiste" })
        setAplazamientoText("")
    }

    const handleActionSubmit = async () => {
        if (!actionMatch) return
        setActionStatus("Enviando...")
        try {
            if (actionTab === "asistencia") {
                if (!attendanceForm.nombre) { setActionStatus("Selecciona tu nombre."); return }
                const current: any[] = Array.isArray(actionMatch.asistencia) ? actionMatch.asistencia : []
                const filtered = current.filter(a => a.nombre !== attendanceForm.nombre)
                filtered.push({ nombre: attendanceForm.nombre, estado: attendanceForm.estado, fecha: new Date().toISOString() })
                await fetch(`/api/crud/partido/${actionMatch.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...actionMatch, asistencia: filtered }),
                })
            } else {
                if (!aplazamientoText.trim()) { setActionStatus("Escribe una justificación."); return }
                await fetch("/api/crud/pqrs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tipo: "aplazamiento",
                        partido_id: actionMatch.id,
                        rival: actionMatch.nombre_rival,
                        texto: aplazamientoText,
                        fecha: new Date().toISOString(),
                    }),
                })
            }
            setActionStatus("¡Enviado con éxito! ✓")
            setTimeout(() => { setActionMatch(null); loadData() }, 1500)
        } catch { setActionStatus("Error al enviar.") }
    }

    // ── Helpers ─────────────────────────────────────────────
    const isPlayed = (p: Partido) =>
        p.goles_pjr !== "" && p.goles_pjr !== null &&
        p.goles_rival !== "" && p.goles_rival !== null

    // ── Render ──────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden p-4 md:p-8">
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full relative z-10 flex flex-col gap-6">

                {/* ── Header ── */}
                <div className="flex items-center justify-between bg-zinc-950/80 backdrop-blur-md p-4 rounded-2xl border border-primary/30 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/")}
                            className="hover:bg-primary/20 text-primary shrink-0">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl md:text-3xl font-black tracking-tight">
                                Calendario de <span className="text-primary">Partidos</span>
                            </h1>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                Ordenado por cercanía
                            </p>
                        </div>
                    </div>

                    {/* ── Admin session control ── */}
                    <div className="flex items-center gap-2 shrink-0">
                        {isAdmin ? (
                            <div className="flex items-center gap-2">
                                <div className="hidden md:flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-xl">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Admin activo
                                </div>
                                <Button variant="ghost" size="sm" onClick={handleLogout}
                                    className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 gap-1.5 text-xs">
                                    <LogOut className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">Cerrar sesión</span>
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => setShowLogin(true)}
                                className="border-primary/30 hover:bg-primary/10 text-primary gap-1.5 text-xs">
                                <LogIn className="h-3.5 w-3.5" />
                                Admin
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={loadData}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>

                {/* ── Admin hint + Fair Play panel ── */}
                {isAdmin && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-xs text-primary/80">
                            <Edit className="h-3.5 w-3.5 shrink-0" />
                            Modo Admin — <strong className="mx-1">✎ Editar</strong> fechas/hora/lugar ·
                            <strong className="mx-1">⚽ Marcador</strong> resultado ·
                            <strong className="mx-1">✔ Terminar</strong> cierra el partido
                        </div>

                        {/* Fair Play Panel */}
                        <div className="bg-zinc-950/80 border border-amber-500/30 rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Star className="h-5 w-5 text-amber-400" />
                                    <span className="font-black text-amber-400 text-base">Fair Play</span>
                                </div>
                                <button
                                    onClick={() => setShowFairplay(v => !v)}
                                    className="text-xs text-muted-foreground hover:text-amber-400 transition-colors"
                                >
                                    {showFairplay ? "Ocultar detalles" : "Ver detalles"}
                                </button>
                            </div>

                            <div className="flex items-end gap-4 mt-2">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Calculado</p>
                                    <p className="text-3xl font-black text-amber-400">{fairplayCalc.calculado}</p>
                                </div>
                                {fairplayFinal !== fairplayCalc.calculado && (
                                    <div>
                                        <p className="text-[10px] text-red-400/70 uppercase tracking-widest">Ajustado</p>
                                        <p className="text-2xl font-black text-red-400">{fairplayFinal}</p>
                                    </div>
                                )}
                            </div>

                            {showFairplay && (
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-amber-500/10 pt-3">
                                    <span className="text-muted-foreground">Base</span><span className="font-bold text-right">+1000</span>
                                    <span className="text-muted-foreground">Amarillas ({fairplayCalc.amarillas})</span>
                                    <span className="font-bold text-yellow-400 text-right">{fairplayCalc.amarillas > 0 ? `−${fairplayCalc.amarillas * 10}` : "0"}</span>
                                    <span className="text-muted-foreground">Rojas ({fairplayCalc.rojas})</span>
                                    <span className="font-bold text-red-400 text-right">{fairplayCalc.rojas > 0 ? `−${fairplayCalc.rojas * 30}` : "0"}</span>
                                    <span className="text-muted-foreground">Partidos limpios ({fairplayCalc.limpios})</span>
                                    <span className="font-bold text-green-400 text-right">{fairplayCalc.limpios > 0 ? `+${fairplayCalc.limpios * 10}` : "0"}</span>
                                    {fairplayCalc.penalizaciones !== 0 && (
                                        <><span className="text-muted-foreground">Penaliz. manuales</span>
                                        <span className="font-bold text-red-400 text-right">{fairplayCalc.penalizaciones}</span></>
                                    )}
                                </div>
                            )}

                            {/* Admin override — only lower */}
                            <div className="flex items-center gap-2 mt-3">
                                <input
                                    type="number"
                                    max={fairplayCalc.calculado - 1}
                                    placeholder={`Ajustar a menos de ${fairplayCalc.calculado}`}
                                    value={fairplayOverride}
                                    onChange={e => { setFairplayOverride(e.target.value); setFpStatus("") }}
                                    className="flex-1 bg-zinc-900 border border-amber-500/30 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <button
                                    onClick={handleFairplaySave}
                                    disabled={fpSaving}
                                    className="bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                                >
                                    {fpSaving ? "..." : "Guardar"}
                                </button>
                            </div>
                            {fpStatus && <p className="text-xs mt-1.5 text-center text-amber-400">{fpStatus}</p>}
                        </div>
                    </div>
                )}

                {/* ── Cards ── */}
                {loading ? (
                    <div className="flex justify-center p-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    </div>
                ) : partidos.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">No hay partidos registrados.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {partidos.map((partido) => {
                            const played = isPlayed(partido)
                            const win = played && Number(partido.goles_pjr) > Number(partido.goles_rival)
                            const loss = played && Number(partido.goles_pjr) < Number(partido.goles_rival)

                            return (
                                <div
                                    key={partido.id}
                                    onClick={() => !played && openAction(partido)}
                                    className={`bg-zinc-950 border rounded-2xl p-5 flex flex-col gap-4 shadow-lg transition-all duration-300 relative
                                        ${!played && !isAdmin
                                            ? "hover:border-primary/60 hover:shadow-primary/10 hover:shadow-xl cursor-pointer active:scale-[0.98]"
                                            : "border-primary/20 hover:border-primary/40"}
                                        ${played ? "opacity-80" : ""}
                                    `}
                                >
                                    {/* ── Match badge row ── */}
                                    <div className="flex justify-between items-center border-b border-primary/10 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-primary/20 text-primary font-black px-2 py-0.5 rounded text-xs">
                                                J{partido.orden || partido.id}
                                            </span>
                                            {partido.local && (
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1
                                                    ${partido.local === "Local" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"}`}>
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    {partido.local}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {played && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1
                                                    ${win ? "bg-green-500/20 text-green-400" : loss ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                                    <Trophy className="h-3 w-3" />
                                                    {win ? "VICTORIA" : loss ? "DERROTA" : "EMPATE"}
                                                </span>
                                            )}
                                            {!played && !isAdmin && (
                                                <span className="text-[10px] text-primary/50 italic flex items-center gap-1">
                                                    <UserCheck className="h-3 w-3" /> Toca para confirmar
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Scoreboard ── */}
                                    <div className="flex justify-between items-center py-1">
                                        <div className="flex flex-col items-center w-[40%]">
                                            <img src="/logo.png" alt="PJR FC"
                                                className="w-12 h-12 object-contain mb-2 drop-shadow-md" />
                                            <span className="font-bold text-sm">PJR FC</span>
                                        </div>

                                        <div className="flex flex-col items-center justify-center w-[20%]">
                                            {played ? (
                                                <div className="flex items-center gap-1.5 text-2xl font-black bg-zinc-900 px-3 py-1 rounded-lg border border-primary/20">
                                                    <span className={win ? "text-green-400" : ""}>{partido.goles_pjr}</span>
                                                    <span className="text-muted-foreground text-base">-</span>
                                                    <span className={loss ? "text-red-400" : ""}>{partido.goles_rival}</span>
                                                </div>
                                            ) : (
                                                <span className="text-2xl font-black text-muted-foreground/50">VS</span>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-center w-[40%]">
                                            {partido.escudo ? (
                                                <img src={partido.escudo} alt={partido.nombre_rival}
                                                    className="w-12 h-12 object-contain mb-2 drop-shadow-md bg-zinc-800/50 rounded-full border border-primary/30 p-1" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-zinc-800 border border-primary/30 flex items-center justify-center mb-2">
                                                    <span className="text-xl font-bold text-primary">
                                                        {partido.nombre_rival?.charAt(0) ?? "?"}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="font-bold text-sm text-center line-clamp-1" title={partido.nombre_rival}>
                                                {partido.nombre_rival || "Rival"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ── Date / Time / Location + Admin Buttons ── */}
                                    <div className="bg-zinc-900 rounded-xl p-3 flex flex-col gap-2 mt-auto border border-primary/5">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                            <span>{partido.dia ? `${partido.dia} de ${partido.mes}` : "Fecha por definir"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                            <span>{partido.hora || "Hora por definir"}</span>
                                        </div>
                                        {partido.tipo === "entrenamiento" && (
                                            <div className="flex items-center gap-1.5 text-xs text-purple-400">
                                                <Dumbbell className="h-3.5 w-3.5" />
                                                Entrenamiento
                                            </div>
                                        )}
                                        {partido.terminado && (
                                            <div className="flex items-center gap-1.5 text-xs text-green-400">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Partido terminado
                                            </div>
                                        )}

                                        {/* Admin action buttons */}
                                        {isAdmin && (
                                            <div className="flex flex-wrap gap-2 pt-1 border-t border-primary/10">
                                                <Button size="sm" variant="outline"
                                                    onClick={(e) => openEdit(partido, e)}
                                                    className="h-8 text-xs font-bold text-primary border-primary/30 hover:bg-primary/20 px-2.5 gap-1">
                                                    <Edit className="h-3 w-3" /> Editar
                                                </Button>
                                                <Button size="sm" variant="outline"
                                                    onClick={(e) => openScore(partido, e)}
                                                    className="h-8 text-xs font-bold text-blue-400 border-blue-400/30 hover:bg-blue-400/10 px-2.5 gap-1">
                                                    <Goal className="h-3 w-3" /> Marcador
                                                </Button>
                                                {!partido.terminado &&
                                                    scoreForm.goles_pjr !== "" && scoreForm.goles_rival !== "" && (
                                                    <Button size="sm" variant="outline"
                                                        onClick={(e) => { e.stopPropagation(); openScore(partido, e) }}
                                                        className="h-8 text-xs font-bold text-green-400 border-green-400/30 hover:bg-green-400/10 px-2.5 gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Terminar
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════
                  LOGIN MODAL (Admin)
                ══════════════════════════════════════ */}
            <LoginModal
                open={showLogin}
                onOpenChange={setShowLogin}
                onLoginSuccess={handleLoginSuccess}
            />

            {/* ══════════════════════════════════════
                  SCORE / FINISH MODAL
                ══════════════════════════════════════ */}
            <Dialog open={!!scoreMatch} onOpenChange={(o) => !o && setScoreMatch(null)}>
                <DialogContent className="sm:max-w-[380px] bg-zinc-950 border-blue-400/30 text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-blue-400 flex items-center gap-2">
                            <Goal className="h-5 w-5" /> Marcador
                        </DialogTitle>
                        {scoreMatch && (
                            <p className="text-sm text-muted-foreground mt-1">
                                PJR FC vs <strong>{scoreMatch.nombre_rival}</strong>
                            </p>
                        )}
                    </DialogHeader>
                    {scoreMatch && (
                        <div className="flex flex-col gap-5 mt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                                        PJR FC
                                    </label>
                                    <input
                                        type="number" min={0}
                                        className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-3 text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary"
                                        value={scoreForm.goles_pjr}
                                        onChange={e => setScoreForm({ ...scoreForm, goles_pjr: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                                        {scoreMatch.nombre_rival}
                                    </label>
                                    <input
                                        type="number" min={0}
                                        className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-3 text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary"
                                        value={scoreForm.goles_rival}
                                        onChange={e => setScoreForm({ ...scoreForm, goles_rival: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button
                                    onClick={() => handleScoreSave(false)}
                                    disabled={scoreSaving}
                                    className="bg-blue-500/20 text-blue-400 border border-blue-400/30 hover:bg-blue-500/30 font-bold gap-2"
                                    variant="outline"
                                >
                                    <Goal className="h-4 w-4" />
                                    {scoreSaving ? "Guardando..." : "Guardar marcador"}
                                </Button>
                                {scoreForm.goles_pjr !== "" && scoreForm.goles_rival !== "" && !scoreMatch.terminado && (
                                    <Button
                                        onClick={() => handleScoreSave(true)}
                                        disabled={scoreSaving}
                                        className="bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30 font-bold gap-2"
                                        variant="outline"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        {scoreSaving ? "Guardando..." : "Guardar y dar por terminado"}
                                    </Button>
                                )}
                                {scoreMatch.terminado && (
                                    <p className="text-center text-xs text-green-400 flex items-center justify-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Partido ya marcado como terminado
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════
                  ADMIN EDIT MODAL
                ══════════════════════════════════════ */}
            <Dialog open={!!editingMatch} onOpenChange={(o) => !o && setEditingMatch(null)}>
                <DialogContent className="sm:max-w-[420px] bg-zinc-950 border-primary/30 text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-primary flex items-center gap-2">
                            <Edit className="h-5 w-5" /> Editar Partido
                        </DialogTitle>
                        {editingMatch && (
                            <p className="text-sm text-muted-foreground mt-1">
                                PJR FC vs <strong>{editingMatch.nombre_rival}</strong>
                            </p>
                        )}
                    </DialogHeader>
                    {editingMatch && (
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Día</label>
                                    <input
                                        type="number" min={1} max={31}
                                        className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        value={editForm.dia}
                                        onChange={e => setEditForm({ ...editForm, dia: e.target.value })}
                                        placeholder="Ej. 18"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Mes</label>
                                    <select
                                        className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        value={editForm.mes}
                                        onChange={e => setEditForm({ ...editForm, mes: e.target.value })}>
                                        <option value="">Selecciona...</option>
                                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Hora</label>
                                <input
                                    className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={editForm.hora}
                                    onChange={e => setEditForm({ ...editForm, hora: e.target.value })}
                                    placeholder="Ej. 8:00 AM"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Localía</label>
                                <select
                                    className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={editForm.local}
                                    onChange={e => setEditForm({ ...editForm, local: e.target.value })}>
                                    <option value="">Selecciona...</option>
                                    <option value="Local">Local</option>
                                    <option value="Visitante">Visitante</option>
                                </select>
                            </div>

                            <Button onClick={handleEditSave} disabled={editSaving}
                                className="w-full mt-1 font-bold bg-primary text-zinc-950 hover:bg-primary/90 h-11">
                                {editSaving ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════
                  USER ACTION MODAL (Asistencia / Aplazamiento)
                ══════════════════════════════════════ */}
            <Dialog open={!!actionMatch} onOpenChange={(o) => !o && setActionMatch(null)}>
                <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-primary/20 text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-primary">Gestión de Partido</DialogTitle>
                        {actionMatch && (
                            <p className="text-sm text-muted-foreground">
                                PJR FC vs <strong>{actionMatch.nombre_rival}</strong>
                            </p>
                        )}
                    </DialogHeader>

                    {actionMatch && (
                        <div className="flex flex-col gap-4 mt-2">
                            {/* Tabs */}
                            <div className="flex bg-zinc-900/80 rounded-xl p-1 border border-primary/20">
                                {(["asistencia", "aplazamiento"] as const).map(tab => (
                                    <button key={tab} onClick={() => setActionTab(tab)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all
                                            ${actionTab === tab
                                                ? "bg-primary text-zinc-950 shadow-sm"
                                                : "text-primary/60 hover:text-primary"}`}>
                                        {tab === "asistencia" ? "Asistencia" : "Aplazamiento"}
                                    </button>
                                ))}
                            </div>

                            {actionTab === "asistencia" ? (
                                <div className="flex flex-col gap-4">
                                    <p className="text-xs text-muted-foreground">
                                        Confirma tu asistencia o reporta ausencia para este partido.
                                    </p>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Tu Nombre</label>
                                        <select
                                            className="w-full bg-zinc-900 border border-primary/30 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={attendanceForm.nombre}
                                            onChange={e => setAttendanceForm({ ...attendanceForm, nombre: e.target.value })}>
                                            <option value="">Selecciona tu nombre...</option>
                                            {players.map(p => (
                                                <option key={p.id} value={p.name}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Estado</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {["asiste", "ausente"].map(estado => (
                                                <button key={estado} onClick={() => setAttendanceForm({ ...attendanceForm, estado })}
                                                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all
                                                        ${attendanceForm.estado === estado
                                                            ? estado === "asiste"
                                                                ? "bg-green-500/20 border-green-500 text-green-400"
                                                                : "bg-red-500/20 border-red-500 text-red-400"
                                                            : "bg-zinc-900 border-zinc-800 text-muted-foreground hover:border-primary/30"}`}>
                                                    {estado === "asiste" ? "✓ Asistiré" : "✗ No voy"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <p className="text-xs text-muted-foreground">
                                        ¿Crees que este partido debería aplazarse? Deja una justificación anónima que la directiva revisará.
                                    </p>
                                    <textarea
                                        className="w-full h-28 bg-zinc-900 border border-primary/30 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="Motivo del aplazamiento..."
                                        value={aplazamientoText}
                                        onChange={e => setAplazamientoText(e.target.value)}
                                    />
                                </div>
                            )}

                            {actionStatus && (
                                <p className={`text-sm text-center font-bold ${actionStatus.includes("Error") || actionStatus.includes("Selecciona") || actionStatus.includes("Escribe")
                                    ? "text-red-400" : "text-green-400"}`}>
                                    {actionStatus}
                                </p>
                            )}

                            <Button onClick={handleActionSubmit}
                                className="w-full font-bold bg-primary text-zinc-950 hover:bg-primary/90 h-11 shadow-md">
                                Enviar
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
