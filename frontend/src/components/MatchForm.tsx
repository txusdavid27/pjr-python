import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

interface MatchFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    partidos: any[]
    onSuccess?: () => void
}

export function MatchForm({ open, onOpenChange, partidos, onSuccess }: MatchFormProps) {
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState(false)
    const [error, setError] = React.useState("")

    const [tipo, setTipo] = React.useState("partido") // partido, amistoso, entrenamiento
    const [rivalMode, setRivalMode] = React.useState("select") // select, custom
    const [selectedRival, setSelectedRival] = React.useState("")
    const [customRival, setCustomRival] = React.useState("")
    
    const [fecha, setFecha] = React.useState("")
    const [hora, setHora] = React.useState("")
    const [local, setLocal] = React.useState("")
    const [cobro, setCobro] = React.useState(15000)

    // Extract unique rivals
    const uniqueRivals = React.useMemo(() => {
        const rivals = partidos
            .map(p => p.nombre_rival)
            .filter(r => r && r !== "PJR FC" && r !== "Nosotros Mismos")
        return Array.from(new Set(rivals)).sort()
    }, [partidos])

    React.useEffect(() => {
        if (open) {
            setTipo("partido")
            setRivalMode("select")
            setSelectedRival("")
            setCustomRival("")
            setFecha("")
            setHora("")
            setLocal("")
            setCobro(15000)
            setSuccess(false)
            setError("")
        }
    }, [open])

    const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTipo = e.target.value;
        setTipo(newTipo);
        if (newTipo === "entrenamiento") {
            setRivalMode("custom");
            setCustomRival("PJR FC");
        } else {
            setRivalMode("select");
            setCustomRival("");
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        let finalRival = "";
        if (tipo === "entrenamiento") {
            finalRival = customRival || "PJR FC";
        } else {
            if (rivalMode === "select" && selectedRival) {
                finalRival = selectedRival;
            } else if (rivalMode === "custom" && customRival) {
                finalRival = customRival;
            } else {
                setError("Debes indicar un rival.");
                return;
            }
        }

        if (!fecha || !hora) {
            setError("Debes seleccionar fecha y hora.");
            return;
        }

        const parts = fecha.split('-');
        const m = parts[1];
        const d = parts[2];
        const monthNames = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const mesStr = monthNames[parseInt(m, 10) - 1];

        // Format hora from 14:30 to 2:30 PM
        let [hStr, minStr] = hora.split(':');
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        const formattedHora = `${h}:${minStr} ${ampm}`;

        let escudo: string | undefined = undefined;
        if (tipo !== "entrenamiento" && rivalMode === "select" && selectedRival) {
            const historicalMatch = partidos.find(p => p.nombre_rival === selectedRival && p.escudo);
            if (historicalMatch) {
                escudo = historicalMatch.escudo;
            }
        }

        const payload = {
            tipo,
            nombre_rival: finalRival,
            dia: parseInt(d, 10).toString(),
            mes: mesStr,
            hora: formattedHora,
            local,
            cobro,
            goles_pjr: 0,
            goles_rival: 0,
            terminado: false,
            ...(escudo ? { escudo } : {})
        }

        try {
            setLoading(true)
            const res = await fetch("/api/crud/partido", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error("Error al guardar")

            setSuccess(true)
            setTimeout(() => {
                onOpenChange(false)
                if (onSuccess) {
                    onSuccess()
                }
            }, 800)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Programar Evento</DialogTitle>
                    <DialogDescription>
                        Crea un nuevo Partido Oficial, Amistoso o Entrenamiento.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo de Evento</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={tipo}
                                onChange={handleTipoChange}
                            >
                                <option value="partido">Partido Oficial</option>
                                <option value="amistoso">Amistoso</option>
                                <option value="entrenamiento">Entrenamiento</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cobro Individual</label>
                            <Input
                                type="number"
                                min={0}
                                step={100}
                                value={cobro}
                                onChange={e => setCobro(Number(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Rival / Nombre del Evento</label>
                        {tipo === "entrenamiento" ? (
                            <Input
                                value={customRival}
                                onChange={e => setCustomRival(e.target.value)}
                                placeholder="Ej: Entrenamiento PJR"
                                required
                            />
                        ) : (
                            <div className="flex gap-2">
                                {rivalMode === "select" ? (
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={selectedRival}
                                        onChange={e => {
                                            if (e.target.value === "otro") {
                                                setRivalMode("custom");
                                                setCustomRival("");
                                            } else {
                                                setSelectedRival(e.target.value);
                                            }
                                        }}
                                        required
                                    >
                                        <option value="">Selecciona un rival...</option>
                                        {uniqueRivals.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                        <option value="otro">--- Otro (Nuevo) ---</option>
                                    </select>
                                ) : (
                                    <>
                                        <Input
                                            className="flex-1"
                                            placeholder="Nombre del rival..."
                                            value={customRival}
                                            onChange={e => setCustomRival(e.target.value)}
                                            required
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setRivalMode("select")}
                                        >
                                            Volver
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha</label>
                            <Input
                                type="date"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Hora</label>
                            <Input
                                type="time"
                                value={hora}
                                onChange={e => setHora(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Cancha / Sede</label>
                        <Input
                            placeholder="Ej: Sede X, Cancha Y..."
                            value={local}
                            onChange={e => setLocal(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-medium">
                            Evento programado correctamente.
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || success} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Evento
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
