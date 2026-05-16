import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { MapPin, Navigation } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export function CheckInButton({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { playerDoc } = useAuth()
    const [partidos, setPartidos] = useState<any[]>([])
    const [jugadores, setJugadores] = useState<any[]>([])
    
    const [selectedPartido, setSelectedPartido] = useState<string>("")
    const [selectedApodo, setSelectedApodo] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<{type: "error" | "success" | "info", msg: string} | null>(null)

    useEffect(() => {
        if (open) {
            fetch("/api/crud/partido")
                .then(res => res.json())
                .then(data => setPartidos(data))
                .catch(err => console.error(err))
                
            fetch("/api/crud/jugador")
                .then(res => res.json())
                .then(data => setJugadores(data))
                .catch(err => console.error(err))
            
            setStatus(null)
        }
    }, [open])

    const loggedInPlayer = useMemo(() => {
        if (!playerDoc || !jugadores.length) return null;
        return jugadores.find(p => String(p.documento || "") === playerDoc || String(p.contacto_propio || "").replace(/\.0$/, "").trim() === playerDoc);
    }, [playerDoc, jugadores]);

    useEffect(() => {
        if (loggedInPlayer) {
            setSelectedApodo(loggedInPlayer.apodo)
        }
    }, [loggedInPlayer])

    const handleCheckIn = () => {
        if (!selectedPartido || !selectedApodo) {
            setStatus({ type: "error", msg: "Selecciona tu jugador y el partido actual." })
            return
        }

        if (!navigator.geolocation) {
            setStatus({ type: "error", msg: "Tu navegador no soporta geolocalización." })
            return
        }

        setLoading(true)
        setStatus({ type: "info", msg: "Obteniendo ubicación GPS..." })

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    setStatus({ type: "info", msg: "Verificando llegada con el servidor..." })
                    const res = await fetch(`/api/check_in_match/${selectedPartido}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            lat: latitude,
                            lng: longitude,
                            apodo: selectedApodo
                        })
                    })
                    
                    const data = await res.json()
                    
                    if (res.ok) {
                        setStatus({ type: "success", msg: data.message })
                        setTimeout(() => onOpenChange(false), 3000)
                    } else {
                        setStatus({ type: "error", msg: data.message || "Error al verificar la llegada" })
                    }
                } catch (error) {
                    setStatus({ type: "error", msg: "Error de red al conectar con el servidor." })
                }
                setLoading(false)
            },
            (error) => {
                let msg = "No se pudo obtener la ubicación."
                if (error.code === error.PERMISSION_DENIED) msg = "Denegaste el permiso de ubicación."
                setStatus({ type: "error", msg })
                setLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-primary/20 text-foreground sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-primary flex items-center gap-2">
                        <Navigation className="h-5 w-5" /> Marcar Llegada
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Confirma tu llegada a la cancha para intentar ganar el bono de $5.000 por ser el primero.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Soy...
                        </label>
                        <select
                            className={`w-full h-10 rounded-md border border-primary/30 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${loggedInPlayer ? "opacity-60 cursor-not-allowed" : ""}`}
                            value={selectedApodo}
                            disabled={!!loggedInPlayer}
                            onChange={(e) => setSelectedApodo(e.target.value)}
                        >
                            <option value="">Seleccione su jugador...</option>
                            {jugadores.map(j => (
                                <option key={j.id} value={j.apodo}>
                                    {j.nombre} ({j.apodo})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Partido Actual
                        </label>
                        <select
                            className="w-full h-10 rounded-md border border-primary/30 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={selectedPartido}
                            onChange={(e) => setSelectedPartido(e.target.value)}
                        >
                            <option value="">Seleccione el partido...</option>
                            {partidos.map(p => (
                                <option key={p.id} value={p.id}>
                                    P{p.orden || p.id} - vs {p.nombre_rival}
                                </option>
                            ))}
                        </select>
                    </div>

                    {status && (
                        <div className={`p-3 rounded-md text-sm border ${
                            status.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                            status.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400 font-bold" :
                            "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        }`}>
                            {status.msg}
                        </div>
                    )}

                    <Button 
                        onClick={handleCheckIn} 
                        disabled={!selectedPartido || !selectedApodo || loading}
                        className="bg-primary text-zinc-950 font-bold hover:bg-primary/90 mt-2 w-full flex items-center justify-center gap-2 h-12 text-lg"
                    >
                        {loading ? "Obteniendo GPS..." : (
                            <>
                                <MapPin className="h-5 w-5" /> ¡Llegué a la cancha!
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
