import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from "@tanstack/react-table"
import {
    Activity,
    AlertCircle,
    Banknote,
    Calendar,
    ChevronDown,
    Clock,
    CreditCard,
    FileText,
    Phone,
    Shirt,
    Target,
    Trophy,
    User,
    Zap,
    MapPin
} from "lucide-react"
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Home } from "lucide-react"

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

import { LoginModal } from "@/components/LoginModal"
import { PaymentForm } from "@/components/PaymentForm"
import { columns, Player } from "../columns"; // Import Player separately

import { CardForm } from "@/components/CardForm"
import { GoalForm } from "@/components/GoalForm"
import { ParticipationForm } from "@/components/ParticipationForm"
import { MatchAdminForm } from "@/components/MatchAdminForm"
import { CheckInButton } from "@/components/CheckInButton"

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

import { MatrixTable } from "@/components/MatrixTable"

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = React.useState<"players" | "matrix">("players")
    const [data, setData] = React.useState<Player[]>([])
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    // Modal State
    const [selectedPlayer, setSelectedPlayer] = React.useState<Player | null>(null)
    const [isModalOpen, setIsModalOpen] = React.useState(false)

    // Payment & Goal State
    const [isLoginOpen, setIsLoginOpen] = React.useState(false)
    const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
    const [isGoalOpen, setIsGoalOpen] = React.useState(false)

    const [isCardOpen, setIsCardOpen] = React.useState(false)
    const [isParticipationOpen, setIsParticipationOpen] = React.useState(false)
    const [isMatchAdminOpen, setIsMatchAdminOpen] = React.useState(false)
    const [isCheckInOpen, setIsCheckInOpen] = React.useState(false)
    const [isAuthenticated, setIsAuthenticated] = React.useState(false)
    const [pendingAction, setPendingAction] = React.useState<"payment" | "goal" | "card" | "participation" | "matchAdmin" | null>(null)

    // Advanced Filter State
    const [advancedFilter, setAdvancedFilter] = React.useState<AdvancedFilter>({
        field: "",
        operator: "contains",
        value: ""
    })

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

    React.useEffect(() => {
        const token = localStorage.getItem("adminToken");
        if (token) {
            setIsAuthenticated(true);
        } else {
            setIsLoginOpen(true);
        }

        fetch("/api/crud/jugador")
            .then((res) => res.json())
            .then((data) => setData(data))
            .catch((err) => console.error("Failed to fetch players:", err))
    }, [])

    const handleViewDetails = (player: Player) => {
        setSelectedPlayer(player)
        setIsModalOpen(true)
    }

    const handlePaymentClick = () => {
        if (isAuthenticated) {
            setIsPaymentOpen(true)
        } else {
            setPendingAction("payment")
            setIsLoginOpen(true)
        }
    }

    const handleGoalClick = () => {
        if (isAuthenticated) {
            setIsGoalOpen(true)
        } else {
            setPendingAction("goal")
            setIsLoginOpen(true)
        }
    }

    const handleCardClick = () => {
        if (isAuthenticated) {
            setIsCardOpen(true)
        } else {
            setPendingAction("card")
            setIsLoginOpen(true)
        }
    }

    const handleParticipationClick = () => {
        if (isAuthenticated) {
            setIsParticipationOpen(true)
        } else {
            setPendingAction("participation")
            setIsLoginOpen(true)
        }
    }

    const handleMatchAdminClick = () => {
        if (isAuthenticated) {
            setIsMatchAdminOpen(true)
        } else {
            setPendingAction("matchAdmin")
            setIsLoginOpen(true)
        }
    }

    const handleLoginSuccess = (token: string) => {
        console.log("Login successful, token:", token)
        localStorage.setItem("adminToken", token)
        setIsAuthenticated(true)
        setIsLoginOpen(false)

        // Resume pending action
        if (pendingAction === "payment") setIsPaymentOpen(true)
        if (pendingAction === "goal") setIsGoalOpen(true)

        if (pendingAction === "card") setIsCardOpen(true)
        if (pendingAction === "participation") setIsParticipationOpen(true)
        if (pendingAction === "matchAdmin") setIsMatchAdminOpen(true)
        setPendingAction(null)
    }

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        setIsAuthenticated(false);
        setIsLoginOpen(true);
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
                    <img src="/logo.png" alt="Logo" className="h-14 w-14 object-contain drop-shadow-[0_0_8px_rgba(188,158,98,0.5)]" />
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-br from-[#bc9e62] via-[#e2cc98] to-[#9b7e45] bg-clip-text text-transparent">
                            PJR FC
                        </h1>
                        <p className="text-xs text-primary/70 font-medium tracking-widest uppercase">Gestión de Plantilla</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 md:mt-0 z-10">
                    <div className="flex gap-2 mr-4">
                        <Button variant="outline" size="sm" onClick={() => navigate("/")} className="border-primary/50 text-primary hover:bg-primary/20">
                            <Home className="h-4 w-4 mr-2" />
                            Público
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleLogout} className="border-red-500/50 text-red-500 hover:bg-red-500/20">
                            <LogOut className="h-4 w-4 mr-2" />
                            Salir
                        </Button>
                    </div>
                    <div className="flex bg-zinc-900/80 rounded-xl p-1 border border-primary/20 mr-4">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setActiveTab("players")}
                            className={`${activeTab === "players" ? "bg-primary text-zinc-950 font-bold" : "text-primary/70 hover:text-primary"} rounded-lg px-4`}
                        >
                            Jugadores
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setActiveTab("matrix")}
                            className={`${activeTab === "matrix" ? "bg-primary text-zinc-950 font-bold" : "text-primary/70 hover:text-primary"} rounded-lg px-4`}
                        >
                            Matriz
                        </Button>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button
                            onClick={handlePaymentClick}
                            className="bg-zinc-900 border border-primary/50 text-primary hover:bg-primary hover:text-zinc-950 transition-all duration-300 shadow-sm"
                        >
                            <Banknote className="mr-2 h-4 w-4" />
                            Abonar
                        </Button>
                        <Button
                            onClick={handleGoalClick}
                            className="bg-zinc-900 border border-primary/50 text-primary hover:bg-primary hover:text-zinc-950 transition-all duration-300 shadow-sm"
                        >
                            <Trophy className="mr-2 h-4 w-4" />
                            Goles
                        </Button>
                        <Button
                            onClick={handleCardClick}
                            className="bg-zinc-900 border border-primary/50 text-primary hover:bg-primary hover:text-zinc-950 transition-all duration-300 shadow-sm"
                        >
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Tarjetas
                        </Button>
                        <Button
                            onClick={handleParticipationClick}
                            className="bg-zinc-900 border border-primary/50 text-primary hover:bg-primary hover:text-zinc-950 transition-all duration-300 shadow-sm"
                        >
                            <User className="mr-2 h-4 w-4" />
                            Partidos
                        </Button>
                        <Button
                            onClick={handleMatchAdminClick}
                            className="bg-zinc-900 border border-primary/50 text-primary hover:bg-primary hover:text-zinc-950 transition-all duration-300 shadow-sm"
                        >
                            <MapPin className="mr-2 h-4 w-4" />
                            Mapa
                        </Button>
                        <Button
                            onClick={() => setIsCheckInOpen(true)}
                            className="bg-primary border border-primary text-zinc-950 font-bold hover:bg-primary/80 transition-all duration-300 shadow-sm"
                        >
                            <MapPin className="mr-2 h-4 w-4" />
                            Llegada
                        </Button>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-900/80 px-4 py-2 rounded-xl border border-primary/20 backdrop-blur-sm shadow-inner">
                        <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">Total Seleccionado</span>
                        <span className={`text-xl font-black ${selectedTotal < 0 ? "text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "text-primary drop-shadow-[0_0_5px_rgba(188,158,98,0.5)]"}`}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(selectedTotal)}
                        </span>
                    </div>
                </div>
            </div>

            {activeTab === "players" ? (
                <>
            {/* Advanced Filter Bar */}
            <div className="flex-none flex flex-wrap items-end py-4 px-5 gap-4 bg-zinc-950/60 backdrop-blur-md rounded-xl border border-primary/20 shadow-sm relative z-20">
                <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <label className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">Filtrar Por</label>
                    <select
                        className="h-10 w-full sm:w-48 rounded-lg border border-primary/30 bg-zinc-900 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                        value={advancedFilter.field as string}
                        onChange={(e) => setAdvancedFilter(prev => ({ ...prev, field: e.target.value as any }))}
                    >
                        <option value="">Seleccione...</option>
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
                </div>
                
                <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <label className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">Condición</label>
                    <select
                        className="h-10 w-full sm:w-40 rounded-lg border border-primary/30 bg-zinc-900 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                        value={advancedFilter.operator}
                        onChange={(e) => setAdvancedFilter(prev => ({ ...prev, operator: e.target.value as any }))}
                    >
                        <option value="contains">Contiene</option>
                        <option value="equals">Es Igual A</option>
                        <option value="greater">Es Mayor Que</option>
                        <option value="less">Es Menor Que</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">Valor</label>
                    <Input
                        placeholder="Escriba aquí el valor..."
                        value={advancedFilter.value}
                        onChange={(e) => setAdvancedFilter(prev => ({ ...prev, value: e.target.value }))}
                        className="h-10 w-full bg-zinc-900 border-primary/30 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
                    />
                </div>

                <Button 
                    variant="ghost" 
                    className="h-10 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    onClick={() => setAdvancedFilter({ field: "", operator: "contains", value: "" })}
                >
                    Limpiar
                </Button>

                <div className="flex-none flex items-center gap-2 ml-auto">
                    <Button
                        variant="outline"
                        className="h-10 border-primary/40 hover:bg-primary/20 hover:text-primary transition-all"
                        onClick={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}
                    >
                        {table.getIsAllRowsSelected() ? "Deseleccionar Todos" : "Seleccionar Todos"}
                    </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 border-primary/40 hover:bg-primary/20 hover:text-primary transition-all">
                            Columnas <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {column.id}
                                    </DropdownMenuCheckboxItem>
                                )
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            </div>
            <div className="flex-1 rounded-xl border border-primary/20 shadow-lg shadow-black/50 overflow-auto bg-zinc-950/60 backdrop-blur-sm relative z-10 scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent">
                <Table>
                    <TableHeader className="bg-zinc-950/90 sticky top-0 z-10 border-b border-primary/20 backdrop-blur-md">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
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
                                        // Don't trigger if clicking checkbox or dropdown
                                        if ((e.target as HTMLElement).closest('[role="checkbox"], [role="menuitem"], button')) return;
                                        handleViewDetails(row.original)
                                    }}
                                    className="cursor-pointer border-b border-primary/10 hover:bg-primary/5 transition-all duration-200 data-[state=selected]:bg-primary/10"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns(handleViewDetails).length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            </>
            ) : (
                <div className="flex-1 overflow-auto rounded-xl shadow-lg border border-primary/20 z-10 bg-zinc-950/80 p-4">
                    <MatrixTable />
                </div>
            )}
            {/* Pagination Controls Removed */}

            {/* Modals */}
            <LoginModal
                open={isLoginOpen}
                onOpenChange={setIsLoginOpen}
                onLoginSuccess={handleLoginSuccess}
            />
            <PaymentForm
                open={isPaymentOpen}
                onOpenChange={setIsPaymentOpen}
                players={data}
            />
            <GoalForm
                open={isGoalOpen}
                onOpenChange={setIsGoalOpen}
                players={data}
            />
            <CardForm
                open={isCardOpen}
                onOpenChange={setIsCardOpen}
                players={data}
            />
            <ParticipationForm
                open={isParticipationOpen}
                onOpenChange={setIsParticipationOpen}
                players={data}
            />


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
                                        className="h-32 w-32 rounded-full object-cover border-[3px] border-primary shadow-[0_0_15px_rgba(188,158,98,0.4)] bg-zinc-800"
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
                                        <p className="text-sm text-muted-foreground">Saldo General</p>
                                        <p className={`text-3xl font-bold ${parseBalance(selectedPlayer.balance) < 0 ? "text-red-400" : "text-green-400"}`}>
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
                                        <div className={`bg-card p-5 rounded-xl border shadow-sm space-y-3 ${selectedPlayer.deuda_total > 0 ? 'border-red-300 ring-1 ring-red-100' : ''}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold flex items-center gap-2 text-lg">
                                                    <CreditCard className="h-5 w-5 text-primary" />
                                                    Estado de Cuenta
                                                </h3>
                                                {selectedPlayer.deuda_total > 0 && (
                                                    <span className="px-2 py-1 bg-red-950/50 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" /> Con Deuda
                                                    </span>
                                                )}
                                            </div>
                                            <InfoItem
                                                icon={Banknote}
                                                label="Aporte Total del Jugador"
                                                value={new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedPlayer.aporte_total)}
                                                className="border-green-900/50 bg-green-950/20"
                                            />
                                            <div className="h-px bg-border my-2" />

                                            <div className="bg-red-950/20 rounded-lg p-4 border border-red-900/50">
                                                <h4 className="text-xs font-bold text-red-400 uppercase mb-3 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" /> Desglose de Deuda (Por qué debes esto)
                                                </h4>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Partidos</span>
                                                        <span className="text-red-500 font-medium">${selectedPlayer.deuda_partidos}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Tarjetas (Amarillas/Rojas)</span>
                                                        <span className="text-red-500 font-medium">${selectedPlayer.deuda_tarjetas}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Uniformes</span>
                                                        <span className="text-red-500 font-medium">${selectedPlayer.deuda_uniformes}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Inscripción anual</span>
                                                        <span className="text-red-500 font-medium">${selectedPlayer.deuda_inscripcion}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Entrenamientos</span>
                                                        <span className="text-red-500 font-medium">${selectedPlayer.entrenamientos}</span>
                                                    </div>
                                                    <div className="h-px bg-red-200 my-2" />
                                                    <div className="flex justify-between font-bold text-lg">
                                                        <span className="text-red-400">Total a Pagar</span>
                                                        <span className="text-red-500">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedPlayer.deuda_total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

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
            <MatchAdminForm open={isMatchAdminOpen} onOpenChange={setIsMatchAdminOpen} />
            <CheckInButton open={isCheckInOpen} onOpenChange={setIsCheckInOpen} />
        </div>
    )
}
