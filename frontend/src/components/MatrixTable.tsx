import * as React from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, RefreshCw, Shield, Dumbbell, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"

interface MatrixRow {
    id: number
    nombre: string
    apodo: string
    jugados: number
    estimado: number
    pagado_total: number
    balance_bruto: number
    [key: string]: any
}

interface Partido {
    id: number
    orden: number
    nombre_rival: string
    escudo?: string
    goles_pjr: string | number
    goles_rival: string | number
    dia?: string
    mes?: string
    tipo?: string       // "partido" | "entrenamiento"
    terminado?: boolean
}

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function parseMatchDate(dia?: string, mes?: string): Date | null {
    if (!dia || !mes) return null
    const m = MONTHS.findIndex(x => x.toLowerCase() === mes.toLowerCase())
    if (m === -1) return null
    const d = parseInt(dia, 10)
    if (isNaN(d)) return null
    return new Date(new Date().getFullYear(), m, d)
}

/** Sort matches: chronologically from oldest to newest */
function sortPartidos(list: Partido[]): Partido[] {
    return [...list].sort((a, b) => {
        const dA = parseMatchDate(a.dia, a.mes)
        const dB = parseMatchDate(b.dia, b.mes)
        if (dA && dB) return dA.getTime() - dB.getTime()
        if (dA && !dB) return -1
        if (!dA && dB) return 1
        return (a.orden || a.id) - (b.orden || b.id)
    })
}

const COL_W = 84 // px — uniform match column width

export function MatrixTable() {
    const navigate = useNavigate()
    const [matrixData, setMatrixData] = React.useState<MatrixRow[]>([])
    const [partidos, setPartidos] = React.useState<Partido[]>([])
    const [loading, setLoading] = React.useState(true)
    const [lastRefresh, setLastRefresh] = React.useState(new Date())

    const { isAdmin } = useAuth()
    const [pendingChanges, setPendingChanges] = React.useState<Record<string, Record<number, number>>>({})
    const [isSaving, setIsSaving] = React.useState(false)

    const loadAll = React.useCallback(() => {
        setLoading(true)
        Promise.all([
            fetch("/api/crud/matrix").then(r => r.json()).catch(() => []),
            fetch("/api/crud/partido").then(r => r.json()).catch(() => []),
            fetch("/api/crud/jugador").then(r => r.json()).catch(() => [])
        ]).then(([matrixRes, partidosRes, jugadoresRes]) => {
            const sorted = sortPartidos(
                Array.isArray(partidosRes) ? partidosRes : []
            )
            setPartidos(sorted)

            let rows: MatrixRow[] = matrixRes && matrixRes.length > 0
                ? matrixRes
                : (Array.isArray(jugadoresRes) ? jugadoresRes : []).map((j: any) => ({
                    id: j.id,
                    nombre: j.nombre,
                    apodo: j.apodo || j.nombre,
                    jugados: 0,
                    estimado: 0,
                    pagado_total: 0,
                    balance_bruto: 0,
                }))

            rows = rows.map(row => {
                const enriched = { ...row }
                sorted.forEach(m => {
                    if (enriched[m.id] === undefined && enriched[String(m.id)] === undefined) {
                        enriched[m.id] = 0
                    }
                })
                return enriched
            })

            rows.sort((a, b) => (a.apodo || "").localeCompare(b.apodo || ""))
            setMatrixData(rows)
            setLastRefresh(new Date())
            setLoading(false)
        })
    }, [])

    React.useEffect(() => {
        loadAll()
        const interval = setInterval(loadAll, 30000)
        return () => clearInterval(interval)
    }, [loadAll])

    const getCell = (row: MatrixRow, matchId: number) => {
        if (pendingChanges[row.apodo]?.[matchId] !== undefined) {
            return pendingChanges[row.apodo][matchId]
        }
        return row[matchId] ?? row[String(matchId)] ?? 0
    }

    const handleCellToggle = (row: MatrixRow, matchId: number) => {
        if (!isAdmin) return;
        const currentVal = getCell(row, matchId);
        const newVal = currentVal === 1 ? 0 : 1;
        
        setPendingChanges(prev => ({
            ...prev,
            [row.apodo]: {
                ...(prev[row.apodo] || {}),
                [matchId]: newVal
            }
        }));
    }

    const handleSave = async () => {
        setIsSaving(true);
        const payload: any[] = [];
        
        Object.entries(pendingChanges).forEach(([apodo, matchChanges]) => {
            const originalRow = matrixData.find(r => r.apodo === apodo);
            if (!originalRow) return;
            
            Object.entries(matchChanges).forEach(([matchIdStr, newVal]) => {
                const matchId = parseInt(matchIdStr, 10);
                const oldVal = originalRow[matchId] ?? originalRow[String(matchId)] ?? 0;
                
                if (newVal !== oldVal) {
                    payload.push({
                        apodo,
                        id_partido: matchId,
                        action: newVal === 1 ? "add" : "remove"
                    });
                }
            });
        });
        
        if (payload.length > 0) {
            try {
                await fetch("/api/bulk/sync_matrix", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setPendingChanges({});
                loadAll();
            } catch (err) {
                console.error(err);
            }
        } else {
            setPendingChanges({});
        }
        setIsSaving(false);
    }

    const isFinished = (p: Partido) =>
        p.terminado === true ||
        (p.goles_pjr !== "" && p.goles_pjr !== null &&
         p.goles_rival !== "" && p.goles_rival !== null)

    const formatDate = (dia?: string, mes?: string) => {
        const d = parseMatchDate(dia, mes)
        if (!d) return null
        return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
            {/* BG glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-[100vw] mx-auto w-full relative z-10 flex flex-col gap-4 p-3 md:p-6">

                {/* ── Header ── */}
                <div className="flex items-center justify-between bg-zinc-950/80 backdrop-blur-md p-4 rounded-2xl border border-primary/30 shadow-md">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/")}
                            className="hover:bg-primary/20 text-primary shrink-0">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl md:text-3xl font-black tracking-tight">
                                Matriz de <span className="text-primary">Participación</span>
                            </h1>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                {partidos.length} partidos · {matrixData.length} jugadores ·{" "}
                                Actualizado {lastRefresh.toLocaleTimeString("es-CO")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {Object.keys(pendingChanges).length > 0 && (
                            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2 font-bold shadow-md animate-in fade-in zoom-in duration-300">
                                <Save className="w-4 h-4" />
                                {isSaving ? "Guardando..." : "Guardar"}
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={loadAll}
                            className="border-primary/30 hover:bg-primary/10 text-primary gap-2 shrink-0">
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            <span className="hidden md:inline">Actualizar</span>
                        </Button>
                    </div>
                </div>

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-4 text-xs px-1">
                    {[
                        { color: "bg-green-500/15 border-green-500/40 text-green-400", label: "Participó", sym: "✓" },
                        { color: "bg-zinc-800/80 border-zinc-700 text-zinc-500", label: "No participó / Pendiente", sym: "–" },
                        { color: "bg-amber-500/10 border-amber-500/30 text-amber-400", label: "Terminado", sym: "✔" },
                        { color: "bg-blue-950/30 border-blue-500/20 text-blue-400", label: "Por jugar", sym: "·" },
                    ].map(({ color, label, sym }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded border flex items-center justify-center font-bold text-[10px] ${color}`}>{sym}</span>
                            <span className="text-muted-foreground">{label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <Dumbbell className="h-4 w-4 text-purple-400" />
                        <span className="text-muted-foreground">Entrenamiento</span>
                    </div>
                </div>

                {/* ── Matrix Table ── */}
                {loading ? (
                    <div className="flex justify-center items-center p-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    </div>
                ) : (
                    <div
                        className="rounded-2xl border border-primary/20 bg-zinc-950/70 backdrop-blur-sm shadow-xl shadow-black/60 overflow-auto"
                        style={{ maxHeight: "78vh" }}
                    >
                        <table className="text-sm border-collapse" style={{ tableLayout: "fixed", width: `${160 + COL_W * partidos.length}px`, minWidth: "100%" }}>

                            {/* ── Column widths ── */}
                            <colgroup>
                                <col style={{ width: 160 }} /> {/* Jugador sticky */}
                                {partidos.map(p => (
                                    <col key={p.id} style={{ width: COL_W }} />
                                ))}
                            </colgroup>

                            {/* ── THEAD ── */}
                            <thead className="sticky top-0 z-20">
                                <tr>
                                    {/* Sticky player col */}
                                    <th
                                        className="sticky left-0 z-30 bg-zinc-950 border-b-2 border-r-2 border-primary/30 px-3 py-2 text-left font-bold text-foreground"
                                        style={{ width: 160, minWidth: 160 }}
                                    >
                                        Jugador
                                    </th>

                                    {/* Match header columns */}
                                    {partidos.map(p => {
                                        const finished = isFinished(p)
                                        const isTraining = p.tipo === "entrenamiento"
                                        const dateStr = formatDate(p.dia, p.mes)
                                        const score = finished
                                            ? `${p.goles_pjr}–${p.goles_rival}`
                                            : null

                                        return (
                                            <th
                                                key={p.id}
                                                style={{ width: COL_W, minWidth: COL_W, maxWidth: COL_W }}
                                                className={`border-b-2 border-r border-primary/10 py-2 px-1 text-center align-top
                                                    ${finished ? "bg-amber-950/20 border-b-amber-500/40" : isTraining ? "bg-purple-950/20" : "bg-blue-950/10"}`}
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    {/* Shield / Training icon */}
                                                    {isTraining ? (
                                                        <div className="w-12 h-12 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center">
                                                            <Dumbbell className="h-6 w-6 text-purple-400" />
                                                        </div>
                                                    ) : p.escudo ? (
                                                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-primary/20 overflow-hidden flex items-center justify-center p-0.5">
                                                            <img
                                                                src={p.escudo}
                                                                alt={p.nombre_rival}
                                                                title={p.nombre_rival}
                                                                className="w-full h-full object-contain"
                                                                onError={e => {
                                                                    e.currentTarget.style.display = "none"
                                                                    const span = document.createElement("span")
                                                                    span.className = "text-lg font-black text-primary"
                                                                    span.textContent = p.nombre_rival?.charAt(0) ?? "?"
                                                                    e.currentTarget.parentElement?.appendChild(span)
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-primary/20 flex items-center justify-center">
                                                            <Shield className="h-6 w-6 text-primary/40" />
                                                        </div>
                                                    )}

                                                    {/* Short rival name */}
                                                    <span
                                                        className="text-[9px] font-bold text-muted-foreground leading-tight text-center px-0.5 line-clamp-2"
                                                        title={p.nombre_rival}
                                                        style={{ wordBreak: "break-word" }}
                                                    >
                                                        {isTraining ? "Entreno" : (p.nombre_rival || "?")}
                                                    </span>

                                                    {/* Date */}
                                                    {dateStr && (
                                                        <span className="text-[8px] text-primary/50 leading-none">{dateStr}</span>
                                                    )}

                                                    {/* Score badge */}
                                                    {score && (
                                                        <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full leading-none">
                                                            {score}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>

                            {/* ── TBODY ── */}
                            <tbody>
                                {matrixData.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        className={`border-b border-primary/5 transition-colors hover:bg-primary/5
                                            ${idx % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30"}`}
                                    >
                                        {/* Sticky player name */}
                                        <td
                                            className="sticky left-0 z-10 bg-inherit border-r-2 border-primary/20 px-3 py-2.5 font-bold text-foreground whitespace-nowrap text-sm"
                                            style={{ minWidth: 160, width: 160 }}
                                        >
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-[11px] font-black text-primary/80 uppercase tracking-wide truncate max-w-[140px]">
                                                    {(row.apodo || row.nombre || "S/N")}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/60 truncate max-w-[140px]">
                                                    {row.nombre}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Participation cells */}
                                        {partidos.map(p => {
                                            const val = getCell(row, p.id)
                                            const isPending = pendingChanges[row.apodo]?.[p.id] !== undefined
                                            const originalVal = row[p.id] ?? row[String(p.id)] ?? 0
                                            const isChanged = isPending && val !== originalVal
                                            
                                            const finished = isFinished(p)
                                            return (
                                                <td
                                                    key={p.id}
                                                    onClick={() => handleCellToggle(row, p.id)}
                                                    style={{ width: COL_W, minWidth: COL_W, maxWidth: COL_W }}
                                                    className={`border-r border-primary/5 text-center align-middle transition-colors
                                                        ${isAdmin ? "cursor-pointer hover:bg-primary/20" : ""}
                                                        ${isChanged ? "ring-inset ring-2 ring-primary bg-primary/20" : ""}
                                                        ${val === 1
                                                            ? finished ? "bg-green-500/15" : "bg-green-500/10"
                                                            : finished ? "bg-amber-950/10" : "bg-blue-950/5"
                                                        }`}
                                                >
                                                    {val === 1 ? (
                                                        <span className={`font-black text-base leading-none ${isChanged ? "text-primary" : "text-green-400"}`}>✓</span>
                                                    ) : (
                                                        <span className={`text-sm leading-none ${isChanged ? "text-primary/50" : "text-muted-foreground/20"}`}>–</span>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}

                                {matrixData.length === 0 && (
                                    <tr>
                                        <td colSpan={1 + partidos.length} className="text-center py-16 text-muted-foreground">
                                            No hay datos de participaciones registradas aún.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
