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
import { parseMatchDate } from "@/lib/utils"

interface CardFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    players: Player[]
    partidos?: any[]
}

export function CardForm({ open, onOpenChange, players, partidos = [] }: CardFormProps) {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")

    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
    const [playerCards, setPlayerCards] = useState<Record<string, string>>({})

    // Form State
    const [formData, setFormData] = useState({
        id_partido: "-1",
        nota: "",
    })

    // Reset when opening
    useEffect(() => {
        if (open) {
            setFormData({
                id_partido: "-1",
                nota: "",
            })
            setSelectedPlayers([])
            setPlayerCards({})
            setSuccess(false)
            setError("")
        }
    }, [open])

    const handleTogglePlayer = (apodo: string) => {
        setSelectedPlayers(prev => {
            if (prev.includes(apodo)) {
                const newValues = { ...playerCards }
                delete newValues[apodo]
                setPlayerCards(newValues)
                return prev.filter(p => p !== apodo)
            } else {
                setPlayerCards(prevCards => ({ ...prevCards, [apodo]: "Amarilla" }))
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
            setError("Debes seleccionar al menos un jugador")
            return
        }

        setLoading(true)
        setError("")

        try {
            const payload = selectedPlayers.map(p => ({
                apodo: p,
                color: playerCards[p] === "Amarilla" ? "A" : "R",
                id_partido: parseInt(formData.id_partido) || -1,
                nota: formData.nota,
                paga: 1
            }))

            const res = await fetch("/api/crud/amonestacion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuccess(true)
            } else {
                setError(data.message || "Failed to register card")
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
                        <div className="h-12 w-12 rounded-full bg-yellow-900/40 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-yellow-400" />
                        </div>
                        <DialogTitle>¡Registro Exitoso!</DialogTitle>
                        <p className="text-center text-muted-foreground">
                            Se registraron amonestaciones para {selectedPlayers.length} jugador(es).
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
                    <DialogTitle>Registrar Amonestaciones</DialogTitle>
                    <DialogDescription>
                        Añade múltiples tarjetas amarillas o rojas a la base de datos de manera masiva.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Jugador(es) ({selectedPlayers.length})</label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between">
                                        {selectedPlayers.length === 0
                                            ? "Seleccionar infractores..."
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
                                    .sort((a, b) => {
                                        const dA = parseMatchDate(a.dia, a.mes);
                                        const dB = parseMatchDate(b.dia, b.mes);
                                        if (!dA && !dB) return 0;
                                        if (!dA) return 1;
                                        if (!dB) return -1;
                                        return dB.getTime() - dA.getTime();
                                    })
                                    .map(p => {
                                        const d = parseMatchDate(p.dia, p.mes);
                                        const dateStr = d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "Sin fecha";
                                        return (
                                            <option key={p.id} value={p.id}>
                                                {p.nombre_rival || p.tipo} - {dateStr}
                                            </option>
                                        )
                                    })}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nota General (Opcional)</label>
                            <Input
                                name="nota"
                                placeholder="e.g. Foul"
                                value={formData.nota}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {selectedPlayers.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <label className="text-sm font-medium">Tarjetas por Jugador</label>
                            <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2">
                                {selectedPlayers.map(p => (
                                    <div key={p} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                                        <span className="flex-1 text-sm font-medium truncate">{p}</span>
                                        <select
                                            className="flex h-8 w-32 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background"
                                            value={playerCards[p] || "Amarilla"}
                                            onChange={(e) => setPlayerCards(prev => ({ ...prev, [p]: e.target.value }))}
                                        >
                                            <option value="Amarilla">Amarilla</option>
                                            <option value="Roja">Roja</option>
                                        </select>
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
                        <Button type="submit" disabled={loading} className="bg-primary text-zinc-950 hover:bg-primary/90">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Tarjetas
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
