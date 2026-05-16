import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
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
import { Label } from "@/components/ui/label"
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react"
import * as React from "react"
import { Player } from "../columns"

interface ParticipationFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    players: Player[]
    partidos?: any[]
}

export function ParticipationForm({ open, onOpenChange, players, partidos = [] }: ParticipationFormProps) {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")
    const [success, setSuccess] = React.useState(false)
    const [selectedPlayers, setSelectedPlayers] = React.useState<string[]>([])
    const [playerMinutes, setPlayerMinutes] = React.useState<Record<string, string>>({})
    
    const [formData, setFormData] = React.useState({
        id_partido: "-1",
    })

    // Reset when opening
    React.useEffect(() => {
        if (open) {
            setFormData({
                id_partido: "-1",
            })
            setSelectedPlayers([])
            setPlayerMinutes({})
            setSuccess(false)
            setError("")
        }
    }, [open])

    const handleTogglePlayer = (apodo: string) => {
        setSelectedPlayers(prev => {
            if (prev.includes(apodo)) {
                const newValues = { ...playerMinutes }
                delete newValues[apodo]
                setPlayerMinutes(newValues)
                return prev.filter(p => p !== apodo)
            } else {
                return [...prev, apodo]
            }
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (selectedPlayers.length === 0) {
            setError("Please select at least one player")
            return
        }

        setLoading(true)
        setError("")

        try {
            const playersPayload = selectedPlayers.map(p => ({
                id_partido: parseInt(formData.id_partido) || -1,
                apodo: p,
                rol: "",
                minutos: parseInt(playerMinutes[p]) || 0,
                paga: 1
            }));

            const res = await fetch("/api/crud/participacion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(playersPayload),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuccess(true)
                // Optional: Close after delay
                setTimeout(() => onOpenChange(false), 2000)
            } else {
                setError(data.message || "Failed to register participation")
            }
        } catch (err) {
            setError("Network error. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    // Sort players alphabetically for easier finding
    const sortedPlayers = [...players].sort((a, b) => a.nombre.localeCompare(b.nombre))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Participación</DialogTitle>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center justify-center p-6 space-y-4 text-green-600">
                        <div className="h-12 w-12 rounded-full bg-green-900/40 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <DialogTitle>¡Registro Exitoso!</DialogTitle>
                        <p className="text-center text-muted-foreground">
                            Se registraron participaciones para {selectedPlayers.length} jugador(es).
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                        {error && (
                            <div className="p-3 text-sm text-red-500 bg-red-950/30 rounded-lg border border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="id_partido">Partido</Label>
                                <select
                                    id="id_partido"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={formData.id_partido}
                                    onChange={(e) => setFormData(prev => ({ ...prev, id_partido: e.target.value }))}
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

                        <div className="grid gap-2">
                            <Label>Jugadores ({selectedPlayers.length})</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between">
                                        {selectedPlayers.length === 0
                                            ? "Seleccionar jugadores..."
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
                                                onSelect={(e) => e.preventDefault()} // Prevent closing
                                            >
                                                <span className="font-medium">{p.nombre}</span>
                                                {p.apodo && <span className="ml-2 text-muted-foreground text-xs">({p.apodo})</span>}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {selectedPlayers.length > 0 && (
                            <div className="space-y-2 mt-2">
                                <Label>Minutos por Jugador</Label>
                                <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2">
                                    {selectedPlayers.map(p => (
                                        <div key={p} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                                            <span className="flex-1 text-sm font-medium truncate">{p}</span>
                                            <Input
                                                type="number"
                                                placeholder="Minutos"
                                                value={playerMinutes[p] || ""}
                                                onChange={(e) => setPlayerMinutes(prev => ({ ...prev, [p]: e.target.value }))}
                                                className="w-32 h-8"
                                                required
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-full mt-2 bg-primary text-zinc-950 hover:bg-primary/90">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Registrar para ${selectedPlayers.length} Jugadores`}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
