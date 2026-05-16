import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Loader2, ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"
import { Player } from "../columns"

interface GoalFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    players: Player[]
    partidos?: any[]
}

export function GoalForm({ open, onOpenChange, players, partidos = [] }: GoalFormProps) {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")

    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
    const [playerGoals, setPlayerGoals] = useState<Record<string, number>>({})

    // Form State
    const [formData, setFormData] = useState({
        id_partido: "-1",
        apodo_asistencia: "",
    })

    // Reset when opening
    useEffect(() => {
        if (open) {
            setFormData({
                id_partido: "-1",
                apodo_asistencia: "",
            })
            setSelectedPlayers([])
            setPlayerGoals({})
            setSuccess(false)
            setError("")
        }
    }, [open])

    const handleTogglePlayer = (apodo: string) => {
        setSelectedPlayers(prev => {
            if (prev.includes(apodo)) {
                const newValues = { ...playerGoals }
                delete newValues[apodo]
                setPlayerGoals(newValues)
                return prev.filter(p => p !== apodo)
            } else {
                return [...prev, apodo]
            }
        })
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedPlayers.length === 0) {
            setError("Debes seleccionar al menos un goleador")
            return
        }

        setLoading(true)
        setError("")

        try {
            const payload: any[] = []
            selectedPlayers.forEach(p => {
                const goalsCount = playerGoals[p] || 1;
                for (let i = 0; i < goalsCount; i++) {
                    payload.push({
                        apodo: p,
                        id_partido: parseInt(formData.id_partido) || -1,
                        apodo_asistencia: formData.apodo_asistencia || "nn",
                        minuto: 0 // Default to 0 for bulk adds
                    })
                }
            })

            const res = await fetch("/api/crud/goles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuccess(true)
            } else {
                setError(data.message || "Failed to register goal")
            }
        } catch (err) {
            setError("Network error. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
    }

    const sortedPlayers = [...players].sort((a, b) => a.nombre.localeCompare(b.nombre))

    if (success) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[425px]">
                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        <div className="h-12 w-12 rounded-full bg-green-900/40 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <DialogTitle>¡Registro Exitoso!</DialogTitle>
                        <p className="text-center text-muted-foreground">
                            Se registraron goles para {selectedPlayers.length} jugador(es).
                        </p>
                        <Button onClick={handleClose} className="w-full">Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Goles</DialogTitle>
                    <DialogDescription>
                        Añade múltiples goles a la base de datos de manera masiva.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Goleador(es) ({selectedPlayers.length})</label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between">
                                        {selectedPlayers.length === 0
                                            ? "Seleccionar goleadores..."
                                            : `${selectedPlayers.length} seleccionados`}
                                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[450px] max-h-[300px] overflow-y-auto" align="start">
                                    <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flex-1 text-xs h-8"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    setSelectedPlayers(sortedPlayers.map(p => p.apodo || p.nombre))
                                                }}
                                            >
                                                Seleccionar Todos
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flex-1 text-xs h-8"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    setSelectedPlayers([])
                                                }}
                                            >
                                                Limpiar
                                            </Button>
                                        </div>
                                    </div>
                                    {sortedPlayers.map((p) => {
                                        const val = p.apodo || p.nombre;
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={p.id}
                                                checked={selectedPlayers.includes(val)}
                                                onCheckedChange={() => handleTogglePlayer(val)}
                                                onSelect={(e) => e.preventDefault()}
                                            >
                                                <span className="font-medium">{p.nombre}</span>
                                                {p.apodo && <span className="ml-2 text-muted-foreground text-xs">({p.apodo})</span>}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Partido</label>
                            <select
                                name="id_partido"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={formData.id_partido}
                                onChange={handleChange}
                            >
                                <option value="-1">Ninguno</option>
                                {partidos
                                    .filter(p => p.fecha || p.dia)
                                    .sort((a, b) => new Date(b.fecha || b.dia).getTime() - new Date(a.fecha || a.dia).getTime())
                                    .map(p => {
                                        const dateStr = new Date(p.fecha || p.dia).toLocaleDateString();
                                        return (
                                            <option key={p.id} value={p.id}>
                                                {p.nombre_rival || p.tipo} - {dateStr}
                                            </option>
                                        )
                                    })}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Asistencia (Opcional, Aplica a todos)</label>
                            <input
                                list="pagewide-players-list"
                                name="apodo_asistencia"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="¿Quién hizo la asistencia?"
                                value={formData.apodo_asistencia}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {selectedPlayers.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <label className="text-sm font-medium">Cantidad de Goles por Jugador</label>
                            <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2">
                                {selectedPlayers.map(p => (
                                    <div key={p} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                                        <span className="flex-1 text-sm font-medium truncate">{p}</span>
                                        <Input
                                            type="number"
                                            placeholder="Goles (Ej. 1)"
                                            value={playerGoals[p] || ""}
                                            onChange={(e) => setPlayerGoals(prev => ({ ...prev, [p]: parseInt(e.target.value) }))}
                                            className="w-32 h-8"
                                            min={1}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {error && (
                        <p className="text-sm text-red-500 font-medium">{error}</p>
                    )}

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Goles
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
