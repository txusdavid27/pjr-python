import {
    ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel,
    getSortedRowModel, SortingState, useReactTable, VisibilityState,
} from "@tanstack/react-table"
import * as React from "react"
import {
    Activity, AlertCircle, Calendar, ChevronDown,
    Clock, CreditCard, FileText, Phone, Shirt, Target, Trophy,
    User, Zap, MapPin, ChevronLeft, LogOut, KeyRound, Search, X, LayoutGrid, List, RefreshCw, Banknote
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { columns, Player } from "../columns";
import { CheckInButton } from "@/components/CheckInButton"
import { useAuth } from "@/contexts/AuthContext"
import { LoginModal } from "@/components/LoginModal"
import { PaymentForm } from "@/components/PaymentForm"
import { CardForm } from "@/components/CardForm"
import { GoalForm } from "@/components/GoalForm"
import { ParticipationForm } from "@/components/ParticipationForm"

// Helper for stats bars
const StatBar = ({ label, value, max = 100, color = "bg-blue-500" }: { label: string, value: number, max?: number, color?: string }) => (
    <div className="space-y-1">
        <div className="flex justify-between text-xs">
            <span className="font-medium text-muted-foreground">{label}</span>
            <span className="font-bold">{value}</span>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
        </div>
    </div>
)

// Helper for info items
const InfoItem = ({ icon: Icon, label, value, className = "" }: { icon: any, label: string, value: string | number, className?: string }) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
        <div className="p-2 bg-primary/10 rounded-full">
            <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium text-sm">{value || "-"}</p>
        </div>
    </div>
)

const parseBalance = (val: string | number): number => {
    if (typeof val === 'string') return parseFloat(val)
    return val
}

type FilterOperator = "contains" | "equals" | "greater" | "less";
interface AdvancedFilter {
    field: keyof Player | "";
    operator: FilterOperator;
    value: string;
}

export default function PublicDashboard() {
    const navigate = useNavigate()
    const location = useLocation()
    const { isAdmin, playerDoc, playerLogin, playerLogout, adminLogin, adminLogout } = useAuth()
    const [data, setData] = React.useState<Player[]>([])
    const [partidos, setPartidos] = React.useState<any[]>([])
    const [sorting, setSorting] = React.useState<SortingState>([{ id: "balance", desc: false }])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    // Modal State
    const [selectedPlayer, setSelectedPlayer] = React.useState<Player | null>(null)
    const [isModalOpen, setIsModalOpen] = React.useState(false)

    // Document login gate
    const [docGate, setDocGate] = React.useState<{ player: Player } | null>(null)
    const [docInput, setDocInput] = React.useState("")
    const [docError, setDocError] = React.useState("")

    const [isCheckInOpen, setIsCheckInOpen] = React.useState(false)

    // Admin Modals
    const [isLoginOpen, setIsLoginOpen] = React.useState(false)
    const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
    const [isCardOpen, setIsCardOpen] = React.useState(false)
    const [isGoalOpen, setIsGoalOpen] = React.useState(false)
    const [isParticipationOpen, setIsParticipationOpen] = React.useState(false)

    React.useEffect(() => {
        if (location.pathname === "/admin" && !isAdmin) {
            setIsLoginOpen(true)
        }
    }, [location.pathname, isAdmin])

    const handleLoginSuccess = (token: string) => {
        if (adminLogin) adminLogin(token)
    }

    // Advanced Filter State — default: search by name, condition: contains
    const [advancedFilter, setAdvancedFilter] = React.useState<AdvancedFilter>({
        field: "name",
        operator: "contains",
        value: ""
    })
    const [viewMode, setViewMode] = React.useState<"table" | "cards">(
        () => (window.innerWidth < 768 ? "cards" : "table")
    )

    const filteredData = React.useMemo(() => {
        if (!advancedFilter.field || !advancedFilter.value) return data;
        
        return data.filter(player => {
            let fieldVal: any;
            if (advancedFilter.field === "name") {
                fieldVal = `${player.nombre || ""} ${player.apodo || ""}`.trim();
            } else if (advancedFilter.field === "balance") {
                fieldVal = parseBalance(player.balance as any);
            } else {
                fieldVal = player[advancedFilter.field as keyof Player];
            }
            
            if (fieldVal === undefined || fieldVal === null) return false;
            
            const strVal = String(fieldVal).toLowerCase();
            const searchVal = advancedFilter.value.toLowerCase();
            const numVal = parseFloat(String(fieldVal));
            const searchNum = parseFloat(advancedFilter.value);

            switch (advancedFilter.operator) {
                case "contains":
                    return strVal.includes(searchVal);
                case "equals":
                    return strVal === searchVal;
                case "greater":
                    return !isNaN(numVal) && !isNaN(searchNum) ? numVal > searchNum : false;
                case "less":
                    return !isNaN(numVal) && !isNaN(searchNum) ? numVal < searchNum : false;
                default:
                    return true;
            }
        });
    }, [data, advancedFilter]);

    // Auto-refresh every 30 seconds so balance_neto always reflects latest changes
    const fetchPlayers = React.useCallback(() => {
        fetch("/api/crud/jugador")
            .then((res) => res.json())
            .then((fresh) => {
                if (!Array.isArray(fresh)) return
                setData(fresh)
                // If a player modal is open, refresh their data too
                setSelectedPlayer(prev => {
                    if (!prev) return prev
                    const updated = fresh.find((p: Player) => p.id === prev.id)
                    return updated ?? prev
                })
            })
            .catch((err) => console.error("Failed to fetch players:", err))

        fetch("/api/crud/partido")
            .then((res) => res.json())
            .then((fresh) => {
                if (!Array.isArray(fresh)) return
                setPartidos(fresh)
            })
            .catch((err) => console.error("Failed to fetch partidos:", err))
    }, [])

    React.useEffect(() => {
        fetchPlayers()
        const interval = setInterval(fetchPlayers, 30000)
        return () => clearInterval(interval)
    }, [fetchPlayers])

    const handleViewDetails = (player: Player) => {
        // Admin can open any card freely
        if (isAdmin) {
            setSelectedPlayer(player)
            setIsModalOpen(true)
            return
        }
        // Normalize player's phone to string (may be a float like 3507502357.0)
        const playerPhone = String(player.contacto_propio || "").replace(/\.0$/, "").trim()

        // If this player already has an active session, open directly
        if (playerDoc && playerDoc === playerPhone) {
            setSelectedPlayer(player)
            setIsModalOpen(true)
            return
        }
        // Otherwise open the phone-number gate
        setDocInput("")
        setDocError("")
        setDocGate({ player })
    }

    const handleDocSubmit = () => {
        if (!docGate) return
        const expected = String(docGate.player.contacto_propio || "").replace(/\.0$/, "").trim()
        const entered = docInput.replace(/\.0$/, "").trim()
        if (entered === expected) {
            playerLogin(entered)
            setSelectedPlayer(docGate.player)
            setIsModalOpen(true)
            setDocGate(null)
        } else {
            setDocError("Número de teléfono incorrecto. Intenta de nuevo.")
        }
    }


    const table = useReactTable({
        data: filteredData,
        // ... unchanged ...
        columns: columns(handleViewDetails),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    const selectedTotal = table.getFilteredSelectedRowModel().rows.reduce((sum, row) => {
        return sum + parseBalance(row.original.balance)
    }, 0)

    return (
        <div className="flex flex-col h-screen w-full max-w-7xl mx-auto p-4 space-y-4 overflow-hidden bg-background text-foreground">
            <div className="flex-none flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-950/80 backdrop-blur-md p-5 rounded-2xl border border-primary/30 shadow-[0_0_15px_rgba(188,158,98,0.15)] relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center gap-4 z-10">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-primary/20 text-primary mr-2">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <img src="/logo.png" alt="Logo" className="h-14 w-14 object-contain drop-shadow-[0_0_8px_rgba(188,158,98,0.5)]" />
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-br from-[#bc9e62] via-[#e2cc98] to-[#9b7e45] bg-clip-text text-transparent">
                            Plantilla
                        </h1>
                        <p className="text-xs text-primary/70 font-medium tracking-widest uppercase">Estadísticas y Saldos</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 md:mt-0 z-10">

                    <div className="flex flex-wrap justify-center gap-3 items-center">
                        {(isAdmin || playerDoc) && (
                            <Button variant="ghost" onClick={() => isAdmin ? adminLogout() : playerLogout()} className="text-red-400 hover:text-red-300 hover:bg-red-950/30 gap-2 border border-red-900/30">
                                <LogOut className="w-4 h-4" />
                                Cerrar Sesión
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fetchPlayers()}
                            className="bg-zinc-950/50 border-primary/20 text-primary hover:bg-primary/20 transition-all duration-300"
                            title="Refrescar Datos"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={() => setIsCheckInOpen(true)}
                            className="bg-primary border border-primary text-zinc-950 font-bold hover:bg-primary/80 transition-all duration-300 shadow-sm"
                        >
                            <MapPin className="mr-2 h-4 w-4" />
                            Llegada
                        </Button>
                        
                        {isAdmin && (
                            <>
                                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => setIsPaymentOpen(true)}>
                                    <Banknote className="mr-2 h-4 w-4" /> Abonar
                                </Button>
                                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => setIsParticipationOpen(true)}>
                                    <Activity className="mr-2 h-4 w-4" /> Part.
                                </Button>
                                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => setIsGoalOpen(true)}>
                                    <Target className="mr-2 h-4 w-4" /> Gol
                                </Button>
                                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => setIsCardOpen(true)}>
                                    <AlertCircle className="mr-2 h-4 w-4" /> Tarjeta
                                </Button>
                            </>
                        )}

                        <div className="bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-primary/20 backdrop-blur-sm flex items-center gap-2">
                            <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">Seleccionados</span>
                            <span className="text-sm font-black text-primary">
                                {Object.keys(rowSelection).length} / {data.length}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-900/80 px-4 py-2 rounded-xl border border-primary/20 backdrop-blur-sm shadow-inner">
                        <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">Total Seleccionado</span>
                        <span className={`text-xl font-black ${selectedTotal < 0 ? "text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "text-primary drop-shadow-[0_0_5px_rgba(188,158,98,0.5)]"}`}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(selectedTotal)}
                        </span>
                    </div>
                </div>

                {/* Player session indicator */}
                {playerDoc && !isAdmin && (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-3 py-1.5 z-10">
                        <KeyRound className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-primary font-semibold">{playerDoc}</span>
                        <button
                            onClick={playerLogout}
                            className="ml-1 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Cerrar sesión de jugador"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Search + Filter Bar (mobile-first) ── */}
            <div className="flex-none bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-primary/20 shadow-sm p-3 md:p-4 relative z-20">
                {/* Primary search row */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50 pointer-events-none" />
                        <Input
                            placeholder="Buscar jugador..."
                            value={advancedFilter.value}
                            onChange={(e) => setAdvancedFilter(prev => ({ ...prev, value: e.target.value }))}
                            className="pl-9 h-12 text-base bg-zinc-900 border-primary/30 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground/50 rounded-xl"
                        />
                        {advancedFilter.value && (
                            <button
                                onClick={() => setAdvancedFilter(prev => ({ ...prev, value: "" }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {/* View toggle: cards / table */}
                    <button
                        onClick={() => setViewMode(v => v === "cards" ? "table" : "cards")}
                        className="h-12 w-12 flex items-center justify-center rounded-xl border border-primary/30 bg-zinc-900 text-primary hover:bg-primary/10 transition-all shrink-0 touch-scale"
                        title={viewMode === "cards" ? "Ver tabla" : "Ver tarjetas"}
                    >
                        {viewMode === "cards" ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
                    </button>
                </div>

                {/* Secondary row: field + condition + actions */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <select
                        className="h-10 flex-1 min-w-[130px] rounded-xl border border-primary/20 bg-zinc-900/80 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-all"
                        value={advancedFilter.field as string}
                        onChange={(e) => setAdvancedFilter(prev => ({ ...prev, field: e.target.value as any }))}
                    >
                        <option value="name">Nombre / Apodo</option>
                        <option value="posicion">Posición</option>
                        <option value="edad">Edad</option>
                        <option value="goles">Goles</option>
                        <option value="asistencias">Asistencias</option>
                        <option value="amarillas">Amarillas</option>
                        <option value="rojas">Rojas</option>
                        <option value="balance">Saldo</option>
                        <option value="deuda_total">Deuda</option>
                        <option value="disputados">Partidos</option>
                    </select>

                    <select
                        className="h-10 flex-1 min-w-[110px] rounded-xl border border-primary/20 bg-zinc-900/80 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-all"
                        value={advancedFilter.operator}
                        onChange={(e) => setAdvancedFilter(prev => ({ ...prev, operator: e.target.value as any }))}
                    >
                        <option value="contains">Contiene</option>
                        <option value="equals">Igual a</option>
                        <option value="greater">Mayor que</option>
                        <option value="less">Menor que</option>
                    </select>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => setAdvancedFilter({ field: "name", operator: "contains", value: "" })}
                            className="h-10 px-3 rounded-xl border border-zinc-700 text-muted-foreground hover:text-red-400 hover:border-red-400/40 text-xs font-medium transition-all"
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}
                            className="h-10 px-3 rounded-xl border border-primary/30 text-primary/80 hover:bg-primary/10 text-xs font-medium transition-all"
                        >
                            {table.getIsAllRowsSelected() ? "Ninguno" : "Todos"}
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="h-10 px-3 rounded-xl border border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/40 text-xs font-medium transition-all flex items-center gap-1">
                                    Col <ChevronDown className="h-3 w-3" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {table.getAllColumns().filter(c => c.getCanHide()).map(column => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={v => column.toggleVisibility(!!v)}
                                    >
                                        {column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-primary/10">
                    <span className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{filteredData.length}</span> jugadores
                        {advancedFilter.value && <span className="text-primary/70"> filtrados</span>}
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                            <span className="font-bold text-primary">{Object.keys(rowSelection).length}</span>/{data.length} seleccionados
                        </span>
                        {Object.keys(rowSelection).length > 0 && (
                            <span className={`text-sm font-black ${
                                selectedTotal < 0 ? "text-red-500" : "text-primary"
                            }`}>
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedTotal)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {/* ── Table or Card view ── */}
            {viewMode === "table" ? (
            <div className="flex-1 rounded-2xl border border-primary/20 shadow-lg shadow-black/50 overflow-auto bg-zinc-950/60 backdrop-blur-sm relative z-10">
                <Table>
                    <TableHeader className="bg-zinc-950/95 sticky top-0 z-10 border-b border-primary/20 backdrop-blur-md">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="py-3 text-xs font-bold text-primary/70 uppercase tracking-wider">
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('[role="checkbox"], [role="menuitem"], button')) return;
                                        handleViewDetails(row.original)
                                    }}
                                    className="cursor-pointer border-b border-primary/10 hover:bg-primary/5 active:bg-primary/10 transition-all duration-150 data-[state=selected]:bg-primary/10 touch-scale"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns(handleViewDetails).length} className="h-24 text-center text-muted-foreground">
                                    No se encontraron jugadores.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            ) : (
            /* ── Mobile Card View ── */
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                {filteredData.length === 0 ? (
                    <div className="col-span-full text-center py-16 text-muted-foreground">No se encontraron jugadores.</div>
                ) : filteredData.map((player, idx) => {
                    const isRotated = player.nombre === "Tomás López Ospina" || player.nombre === "Iván Santiago Ruiz Cardozo"
                    const bal = parseBalance(player.balance as any)
                    return (
                        <div
                            key={player.id}
                            onClick={() => handleViewDetails(player)}
                            className="bg-zinc-950/80 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 active:scale-[0.98] transition-all duration-150 shadow-md animate-fade-up touch-scale"
                            style={{ animationDelay: `${idx * 30}ms` }}
                        >
                            <img
                                src={(player as any).photo || "/logo.png"}
                                alt={player.nombre}
                                onError={e => {
                                    const t = e.currentTarget
                                    if (!t.src.endsWith("/logo.png")) t.src = "/logo.png"
                                }}
                                className={`w-14 h-14 rounded-full object-cover border-2 border-primary/30 bg-zinc-800 shrink-0 ${isRotated ? "rotate-90" : ""}`}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground truncate text-sm">{player.nombre}</p>
                                {player.apodo && (
                                    <p className="text-xs text-primary/70 font-medium truncate">&ldquo;{player.apodo}&rdquo;</p>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {player.posicion && (
                                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{player.posicion}</span>
                                    )}
                                    <span className={`text-xs font-bold ${
                                        bal < 0 ? "text-red-400" : bal > 0 ? "text-green-400" : "text-muted-foreground"
                                    }`}>
                                        {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(bal)}
                                    </span>
                                    {/* Deuda temporada pasada badge */}
                                    {((player as any).deuda_pasada || 0) > 0 && (
                                        <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                            ⚠ T.Pasada
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-xs text-muted-foreground">⚽ {player.goles ?? 0}</span>
                                <span className="text-xs text-muted-foreground">🟨 {player.amarillas ?? 0}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
            )}

            {/* Modals */}

            {/* Player Details Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-primary/30 bg-zinc-950 shadow-[0_0_50px_rgba(188,158,98,0.15)]">
                    {selectedPlayer && (
                        <div className="flex flex-col">
                            {/* Header Section */}
                            <div className="relative h-48 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white p-6 overflow-hidden border-b border-primary/20">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <Trophy className="h-64 w-64 transform rotate-12 translate-x-12 -translate-y-12 text-primary" />
                                </div>
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
                                <div className="relative z-10 flex items-end gap-6 h-full">
                                    <img
                                        src={selectedPlayer.photo}
                                        alt={selectedPlayer.nombre}
                                        className={`h-32 w-32 rounded-full object-cover border-[3px] border-primary shadow-[0_0_15px_rgba(188,158,98,0.4)] bg-zinc-800 ${selectedPlayer.nombre === "Tomás López Ospina" || selectedPlayer.nombre === "Iván Santiago Ruiz Cardozo" ? "rotate-90" : ""}`}
                                        onError={(e) => { e.currentTarget.src = "/logo.png" }}
                                    />
                                    <div className="mb-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-zinc-900/80 backdrop-blur-sm border border-primary/40 text-primary tracking-widest">
                                                #{selectedPlayer.numero}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest ${selectedPlayer.activo === 'Y' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
                                                {selectedPlayer.activo === 'Y' ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </div>
                                        <h2 className="text-4xl font-black drop-shadow-md tracking-tight">{selectedPlayer.nombre}</h2>
                                        <p className="text-primary/80 font-semibold flex items-center gap-2 text-sm tracking-wide mt-1">
                                            {selectedPlayer.apodo && `"${selectedPlayer.apodo}"`} • {selectedPlayer.posicion}
                                        </p>
                                    </div>
                                    <div className="ml-auto mb-2 text-right hidden sm:block">
                                        <p className="text-sm text-muted-foreground">Balance Neto</p>
                                        <p className={`text-3xl font-bold ${(Number((selectedPlayer as any).BALANCE_NETO) || 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                                            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(parseBalance(selectedPlayer.balance))}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-8 bg-muted/30/50 dark:bg-background/50">
                                {/* Financial Overview (Mobile Only) */}
                                <div className="sm:hidden bg-card p-4 rounded-xl border shadow-sm">
                                    <p className="text-sm text-muted-foreground text-center">Saldo General</p>
                                    <p className={`text-3xl font-bold text-center ${parseBalance(selectedPlayer.balance) < 0 ? "text-red-500" : "text-green-600"}`}>
                                        {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(parseBalance(selectedPlayer.balance))}
                                    </p>
                                </div>

                                {/* Main Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Left Column: Stats & Attributes */}
                                    <div className="space-y-6 md:col-span-2">
                                        {/* Game Stats */}
                                        <div className="bg-card p-5 rounded-xl border shadow-sm">
                                            <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                                                <Activity className="h-5 w-5 text-primary" />
                                                Estadísticas de Rendimiento
                                            </h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                <div className="text-center p-3 bg-muted/30 rounded-lg">
                                                    <div className="text-2xl font-bold text-foreground">{selectedPlayer.goles}</div>
                                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Goles</div>
                                                </div>
                                                <div className="text-center p-3 bg-muted/30 rounded-lg">
                                                    <div className="text-2xl font-bold text-foreground">{selectedPlayer.asistencias}</div>
                                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Asistencias</div>
                                                </div>
                                                <div className="text-center p-3 bg-muted/30 rounded-lg">
                                                    <div className="text-2xl font-bold text-foreground">{selectedPlayer.atajadas}</div>
                                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Atajadas</div>
                                                </div>
                                                <div className="text-center p-3 bg-muted/30 rounded-lg">
                                                    <div className="text-2xl font-bold text-foreground">{selectedPlayer.disputados}</div>
                                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Partidos</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 mt-4">
                                                <div className="flex flex-col items-center p-2 bg-yellow-950/30 rounded border border-yellow-900/50">
                                                    <div className="flex items-center gap-1 text-yellow-700 font-bold">
                                                        <div className="w-3 h-4 bg-yellow-400 rounded-sm" />
                                                        {selectedPlayer.amarillas}
                                                    </div>
                                                    <span className="text-[10px] text-yellow-400/80">Amarillas</span>
                                                </div>
                                                <div className="flex flex-col items-center p-2 bg-red-950/30 rounded border border-red-900/50">
                                                    <div className="flex items-center gap-1 text-red-700 font-bold">
                                                        <div className="w-3 h-4 bg-red-500 rounded-sm" />
                                                        {selectedPlayer.rojas}
                                                    </div>
                                                    <span className="text-[10px] text-red-500/80">Rojas</span>
                                                </div>
                                                <div className="flex flex-col items-center p-2 bg-blue-950/30 rounded border border-blue-900/50">
                                                    <div className="flex items-center gap-1 text-blue-700 font-bold">
                                                        <Trophy className="h-3 w-3" />
                                                        {selectedPlayer.bonos}
                                                    </div>
                                                    <span className="text-[10px] text-blue-600/80">Bonos</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Attributes */}
                                        <div className="bg-card p-5 rounded-xl border shadow-sm">
                                            <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                                                <Zap className="h-5 w-5 text-primary" />
                                                Atributos
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                                <StatBar label="Velocidad" value={selectedPlayer.velocidad} color="bg-cyan-500" />
                                                <StatBar label="Resistencia" value={selectedPlayer.resistencia} color="bg-green-500" />
                                                <StatBar label="Fuerza" value={selectedPlayer.fuerza} color="bg-red-500" />
                                                <StatBar label="Tiro" value={selectedPlayer.tiro} color="bg-orange-500" />
                                                <StatBar label="Pase" value={selectedPlayer.pase} color="bg-indigo-500" />
                                                <StatBar label="Defensa" value={selectedPlayer.defenza} color="bg-slate-600" />
                                                <StatBar label="Ataque" value={selectedPlayer.ataque} color="bg-rose-500" />
                                                <StatBar label="Cabeza" value={selectedPlayer.cabeza} color="bg-purple-500" />
                                            </div>
                                        </div>

                                        {/* Traits */}
                                        <div className="bg-card p-5 rounded-xl border shadow-sm">
                                            <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                                                <Target className="h-5 w-5 text-primary" />
                                                Análisis y Rasgos
                                            </h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase">Fortalezas</span>
                                                    <p className="text-sm mt-1">{selectedPlayer.fortalezas || "N/A"}</p>
                                                </div>
                                                <div className="h-px bg-border" />
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase">Debilidades</span>
                                                    <p className="text-sm mt-1">{selectedPlayer.debilidades || "N/A"}</p>
                                                </div>
                                                <div className="h-px bg-border" />
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-xs font-bold text-muted-foreground uppercase">Carácter</span>
                                                        <p className="text-sm mt-1">{selectedPlayer.caracter || "N/A"}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-muted-foreground uppercase">Lesiones</span>
                                                        <p className="text-sm mt-1 text-red-500">{selectedPlayer.lesiones || "Ninguna"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Personal & Financial */}
                                    <div className="space-y-6">
                                        {/* Personal Info */}
                                        <div className="bg-card p-5 rounded-xl border shadow-sm space-y-3">
                                            <h3 className="font-semibold flex items-center gap-2 mb-2 text-lg">
                                                <User className="h-5 w-5 text-primary" />
                                                Información Personal
                                            </h3>
                                            <InfoItem icon={Calendar} label="Fecha de Nacimiento" value={selectedPlayer.nacimiento} />
                                            <InfoItem icon={Clock} label="Edad" value={`${selectedPlayer.edad} años`} />
                                            <InfoItem icon={FileText} label="Documento" value={selectedPlayer.documento} />
                                            <InfoItem icon={Phone} label="Contacto" value={selectedPlayer.contacto_propio} />
                                            <InfoItem icon={AlertCircle} label="Contacto de Emergencia" value={selectedPlayer.contacto_emergencia} />
                                        </div>

                                        {/* Financial Details */}
                                        {(() => {
                                            const fmt = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v)
                                            // Recalculate balance from components — always fresh
                                            const deudaPasada = Number(selectedPlayer.deuda_pasada) || 0
                                            const deudaPartidos = Number((selectedPlayer as any).deuda_partidos) || 0
                                            const deudaTarjetas = Number((selectedPlayer as any).deuda_tarjetas) || 0
                                            const deudaUniformes = Number((selectedPlayer as any).deuda_uniformes) || 0
                                            const deudaInscripcion = Number((selectedPlayer as any).deuda_inscripcion) || 0
                                            const deudaEntrenamientos = Number((selectedPlayer as any).entrenamientos) || 0
                                            const deudaAmistosos = Number((selectedPlayer as any).deuda_amistosos) || 0
                                            const abonado = Number((selectedPlayer as any).abonado) || 0
                                            const bonos = Number((selectedPlayer as any).bonos) || 0
                                            // Total debt this season (excluding past season)
                                            const deudaTemporada = deudaPartidos + deudaAmistosos + deudaTarjetas + deudaUniformes + deudaInscripcion + deudaEntrenamientos
                                            // BALANCE_NETO from API (most authoritative)
                                            const balanceNeto = Number((selectedPlayer as any).BALANCE_NETO ?? (selectedPlayer as any).balance_neto) || 0
                                            const hasDebt = balanceNeto < 0
                                            const hasPastDebt = deudaPasada > 0

                                            return (
                                                <div className={`bg-card p-5 rounded-xl border shadow-sm space-y-3 ${
                                                    hasDebt ? 'border-red-500/40 ring-1 ring-red-500/20' : 'border-green-500/20'
                                                }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="font-semibold flex items-center gap-2 text-lg">
                                                            <CreditCard className="h-5 w-5 text-primary" />
                                                            Estado de Cuenta
                                                        </h3>
                                                        <span className={`px-2 py-1 text-xs font-black rounded-full flex items-center gap-1 ${
                                                            hasDebt
                                                                ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                                                                : 'bg-green-950/60 text-green-400 border border-green-500/30'
                                                        }`}>
                                                            {hasDebt ? <><AlertCircle className="h-3 w-3" /> Con Deuda</> : '✓ Al Día'}
                                                        </span>
                                                    </div>

                                                    {/* BALANCE NETO — main figure */}
                                                    <div className={`rounded-xl p-4 text-center ${
                                                        hasDebt ? 'bg-red-950/30 border border-red-500/20' : 'bg-green-950/30 border border-green-500/20'
                                                    }`}>
                                                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Balance Neto</p>
                                                        <p className={`text-3xl font-black ${ hasDebt ? 'text-red-400' : 'text-green-400' }`}>
                                                            {fmt(balanceNeto)}
                                                        </p>
                                                        {abonado > 0 && (
                                                            <p className="text-xs text-green-400/70 mt-1">+{fmt(abonado)} abonado</p>
                                                        )}
                                                    </div>

                                                    {/* Deuda temporada pasada — banner prominente */}
                                                    {hasPastDebt && (
                                                        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-start gap-3">
                                                            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-xs font-black text-amber-400 uppercase tracking-wider">⚠ Deuda Temporada Pasada</p>
                                                                <p className="text-lg font-black text-amber-300 mt-0.5">{fmt(deudaPasada)}</p>
                                                                <p className="text-[10px] text-amber-400/70 mt-1">Esta deuda viene de la temporada anterior y está incluida en tu balance neto.</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Desglose temporada actual / Responsabilidades */}
                                                    {deudaTemporada > 0 && (
                                                        <div className="bg-red-950/20 rounded-lg p-4 border border-red-900/30">
                                                            <h4 className="text-xs font-bold text-red-400 uppercase mb-3 flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Responsabilidades
                                                            </h4>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {deudaPartidos > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Partidos Oficiales</span>
                                                                        <span className="text-red-400 font-medium">{fmt(deudaPartidos)}</span>
                                                                    </div>
                                                                )}
                                                                {deudaAmistosos > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Amistosos</span>
                                                                        <span className="text-red-400 font-medium">{fmt(deudaAmistosos)}</span>
                                                                    </div>
                                                                )}
                                                                {deudaEntrenamientos > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Entrenamientos</span>
                                                                        <span className="text-red-400 font-medium">{fmt(deudaEntrenamientos)}</span>
                                                                    </div>
                                                                )}
                                                                {deudaTarjetas > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Tarjetas (🟨/🟥)</span>
                                                                        <span className="text-red-400 font-medium">{fmt(deudaTarjetas)}</span>
                                                                    </div>
                                                                )}
                                                                {deudaUniformes > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Uniforme</span>
                                                                        <span className="text-red-400 font-medium">{fmt(deudaUniformes)}</span>
                                                                    </div>
                                                                )}
                                                                {deudaInscripcion > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Inscripción anual</span>
                                                                        <span className="text-red-400 font-medium">{fmt(deudaInscripcion)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="h-px bg-red-800/30 my-1" />
                                                                <div className="flex justify-between font-bold">
                                                                    <span className="text-red-300 text-sm">Total Responsabilidades</span>
                                                                    <span className="text-red-400">{fmt(deudaTemporada)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Aporte total */}
                                                    {(selectedPlayer as any).aporte_total > 0 && (
                                                        <div className="flex justify-between items-center pt-1">
                                                            <span className="text-xs text-muted-foreground">Aporte total realizado</span>
                                                            <span className="text-green-400 font-bold text-sm">{fmt(Number((selectedPlayer as any).aporte_total))}</span>
                                                        </div>
                                                    )}
                                                    {bonos > 0 && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-muted-foreground">Bonos ganados</span>
                                                            <span className="text-green-400 font-bold text-sm">{fmt(bonos)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}

                                        {/* Roles & Position */}
                                        <div className="bg-card p-5 rounded-xl border shadow-sm">
                                            <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                                                <Shirt className="h-5 w-5 text-primary" />
                                                Posición y Roles
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-3 py-1 rounded-full bg-muted text-foreground text-sm font-medium border">
                                                    {selectedPlayer.posicion}
                                                </span>
                                                {selectedPlayer.posicion_secundaria && (
                                                    <span className="px-3 py-1 rounded-full bg-muted/30 text-muted-foreground text-sm font-medium border border-dashed">
                                                        {selectedPlayer.posicion_secundaria}
                                                    </span>
                                                )}
                                            </div>
                                            {selectedPlayer.roles && (
                                                <div className="mt-4">
                                                    <p className="text-xs text-muted-foreground mb-2">ROLES</p>
                                                    <p className="text-sm">{selectedPlayer.roles}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <CheckInButton open={isCheckInOpen} onOpenChange={setIsCheckInOpen} />

            {/* ── Phone Login Gate ── */}
            <Dialog open={!!docGate} onOpenChange={(o) => { if (!o) setDocGate(null) }}>
                <DialogContent className="sm:max-w-[380px] bg-zinc-950 border-primary/30 text-foreground">
                    <div className="flex flex-col items-center gap-2 pt-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                            <Phone className="h-7 w-7 text-primary" />
                        </div>
                        <h2 className="text-xl font-black text-primary">Acceso a Tarjeta</h2>
                        {docGate && (
                            <p className="text-sm text-muted-foreground text-center">
                                Ingresa tu número de teléfono para ver la tarjeta de
                                <strong className="text-foreground"> {docGate.player.nombre}</strong>
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-3 mt-4">
                        <input
                            type="tel"
                            inputMode="numeric"
                            className="w-full bg-zinc-900 border border-primary/30 rounded-xl p-3 text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Ej. 3123456789"
                            value={docInput}
                            onChange={e => { setDocInput(e.target.value); setDocError("") }}
                            onKeyDown={e => e.key === "Enter" && handleDocSubmit()}
                            autoFocus
                        />
                        {docError && (
                            <p className="text-red-400 text-sm text-center font-medium">{docError}</p>
                        )}
                        <button
                            onClick={handleDocSubmit}
                            className="w-full bg-primary text-zinc-950 font-bold rounded-xl py-3 hover:bg-primary/90 transition-colors text-base"
                        >
                            Entrar
                        </button>
                        <p className="text-[11px] text-muted-foreground/60 text-center">
                            Solo podrás ver tu propia tarjeta. Tu sesión se mantiene mientras navegas.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            <CheckInButton open={isCheckInOpen} onOpenChange={setIsCheckInOpen} />

            {/* Admin Modals */}
            <LoginModal
                open={isLoginOpen}
                onOpenChange={setIsLoginOpen}
                onLoginSuccess={handleLoginSuccess}
            />
            {isAdmin && (
                <>
                    <PaymentForm
                        open={isPaymentOpen}
                        onOpenChange={setIsPaymentOpen}
                        players={data}
                        partidos={partidos}
                    />
                    <GoalForm
                        open={isGoalOpen}
                        onOpenChange={setIsGoalOpen}
                        players={data}
                        partidos={partidos}
                    />
                    <CardForm
                        open={isCardOpen}
                        onOpenChange={setIsCardOpen}
                        players={data}
                        partidos={partidos}
                    />
                    <ParticipationForm
                        open={isParticipationOpen}
                        onOpenChange={setIsParticipationOpen}
                        players={data}
                        partidos={partidos}
                    />
                </>
            )}
        </div>
    )
}
