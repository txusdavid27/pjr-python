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

interface PaymentFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    players: Player[]
    partidos?: any[]
}

export function PaymentForm({ open, onOpenChange, players, partidos = [] }: PaymentFormProps) {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")

    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
    const [playerValues, setPlayerValues] = useState<Record<string, string>>({})

    // Form State
    const [formData, setFormData] = useState({
        tipo: "abono", // default
        medio: "efectivo", // default locked for abono
        nota: "pago cuota", // default
        id_partido: "-1", // default
    })

    // Reset when opening
    useEffect(() => {
        if (open) {
            setFormData({
                tipo: "abono",
                medio: "efectivo",
                nota: "pago cuota",
                id_partido: "-1",
            })
            setSelectedPlayers([])
            setPlayerValues({})
            setSuccess(false)
            setError("")
        }
    }, [open])

    const handleTogglePlayer = (apodo: string) => {
        setSelectedPlayers(prev => {
            if (prev.includes(apodo)) {
                // remove from values as well
                const newValues = { ...playerValues }
                delete newValues[apodo]
                setPlayerValues(newValues)
                return prev.filter(p => p !== apodo)
            } else {
                return [...prev, apodo]
            }
        })
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === "tipo" && value === "abono") {
                updated.medio = "efectivo"; // Force efectivo if it's abono
            }
            return updated;
        })
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
                tipo: formData.tipo,
                valor: parseInt(playerValues[p]) || 0,
                medio: formData.tipo === "abono" ? "efectivo" : formData.medio,
                nota: formData.nota,
                id_partido: parseInt(formData.id_partido) || -1
            }))

            const res = await fetch("/api/crud/pago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuccess(true)
                setTimeout(() => onOpenChange(false), 2000)
            } else {
                setError(data.message || "Failed to register payment")
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
                    <div className="flex flex-col items-center justify-center p-6 space-y-4 text-green-600">
                        <div className="h-12 w-12 rounded-full bg-green-900/40 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <DialogTitle>¡Registro Exitoso!</DialogTitle>
                        <p className="text-center text-muted-foreground">
                            Se registraron pagos para {selectedPlayers.length} jugador(es).
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Nuevo Pago</DialogTitle>
                    <DialogDescription>
                        Agrega un nuevo registro de pago a la base de datos.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Jugadores ({selectedPlayers.length})</label>
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
                            <label className="text-sm font-medium">Tipo</label>
                            <select
                                name="tipo"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.tipo}
                                onChange={handleChange}
                            >
                                <option value="abono">Abono</option>
                                <option value="cancha">Cancha</option>
                                <option value="uniforme">Uniforme</option>
                                <option value="inscripcion">Inscripcion</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Partido (Opcional)</label>
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Medio de Pago</label>
                            <select
                                name="medio"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.tipo === "abono" ? "efectivo" : formData.medio}
                                onChange={handleChange}
                                disabled={formData.tipo === "abono"}
                            >
                                <option value="efectivo">Efectivo</option>
                                <option value="nequi">Nequi</option>
                                <option value="daviplata">Daviplata</option>
                                <option value="bancolombia">Bancolombia</option>
                            </select>
                            {formData.tipo === "abono" && (
                                <p className="text-xs text-yellow-500 font-medium">
                                    Los abonos solo pueden registrarse en efectivo por ahora.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nota</label>
                            <Input
                                name="nota"
                                placeholder="E.g. Pago cuota mensual"
                                value={formData.nota}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {selectedPlayers.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <label className="text-sm font-medium">Valores por Jugador</label>
                            <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2">
                                {selectedPlayers.map(p => (
                                    <div key={p} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border">
                                        <span className="flex-1 text-sm font-medium truncate">{p}</span>
                                        <Input
                                            type="number"
                                            placeholder="Monto ($)"
                                            value={playerValues[p] || ""}
                                            onChange={(e) => setPlayerValues(prev => ({ ...prev, [p]: e.target.value }))}
                                            className="w-32 h-8"
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
                            Registrar Pago
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
