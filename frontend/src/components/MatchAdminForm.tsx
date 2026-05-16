import { useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MapPin, Save, Map } from "lucide-react"

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }: { position: any, setPosition: any }) {
    useMapEvents({
        click(e: any) {
            setPosition(e.latlng)
        },
    })

    return position === null ? null : (
        <Marker position={position}></Marker>
    )
}

export function MatchAdminForm({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const [partidos, setPartidos] = useState<any[]>([])
    const [selectedPartido, setSelectedPartido] = useState<string>("")
    const [position, setPosition] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [configData, setConfigData] = useState<any>(null)

    useEffect(() => {
        if (open) {
            fetch("/api/crud/partido")
                .then(res => res.json())
                .then(data => setPartidos(data))
                .catch(err => console.error(err))
            
            fetchConfig()
        }
    }, [open])

    const fetchConfig = async () => {
        try {
            const res = await fetch("/api/crud/config/1");
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    setConfigData(data.data);
                    return;
                }
            }
            // If not found, create id 1
            const createRes = await fetch("/api/crud/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: 1, cancha1: null, cancha2: null })
            });
            if (createRes.ok) {
                setConfigData({ id: 1, cancha1: null, cancha2: null });
            }
        } catch (e) {
            console.error("Config fetch error", e);
        }
    }

    useEffect(() => {
        if (selectedPartido) {
            const partido = partidos.find(p => p.id.toString() === selectedPartido)
            if (partido && partido.latitud && partido.longitud) {
                setPosition({ lat: parseFloat(partido.latitud), lng: parseFloat(partido.longitud) })
            } else {
                setPosition(null) // Bogota default will be used by MapContainer but marker is null
            }
        }
    }, [selectedPartido, partidos])

    const handleSavePartido = async () => {
        if (!selectedPartido || !position) return
        setLoading(true)

        try {
            const res = await fetch(`/api/crud/partido/${selectedPartido}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    latitud: position.lat,
                    longitud: position.lng
                })
            })
            if (res.ok) {
                alert("Ubicación del partido guardada con éxito")
                onOpenChange(false)
            } else {
                alert("Error al guardar la ubicación")
            }
        } catch (e) {
            console.error(e)
            alert("Error de conexión")
        }
        setLoading(false)
    }

    const saveDefaultConfig = async (canchaKey: "cancha1" | "cancha2") => {
        if (!position) return;
        try {
            const updatedConfig = { ...configData, [canchaKey]: { lat: position.lat, lng: position.lng } };
            const res = await fetch(`/api/crud/config/1`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedConfig)
            });
            if (res.ok) {
                setConfigData(updatedConfig);
                alert(`Guardado como predeterminado para ${canchaKey === 'cancha1' ? 'Cancha 1' : 'Cancha 2'}`);
            }
        } catch(e) {
            console.error(e);
            alert("Error al guardar la configuración");
        }
    }

    const useDefaultConfig = (canchaKey: "cancha1" | "cancha2") => {
        if (configData && configData[canchaKey]) {
            setPosition(configData[canchaKey]);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-primary/20 text-foreground sm:max-w-[700px] h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-primary flex items-center gap-2">
                        <MapPin className="h-5 w-5" /> Configurar Ubicación de Partido
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 flex-1 overflow-hidden">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Seleccionar Partido
                        </label>
                        <select
                            className="w-full h-10 rounded-md border border-primary/30 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={selectedPartido}
                            onChange={(e) => setSelectedPartido(e.target.value)}
                        >
                            <option value="">Seleccione un partido...</option>
                            {partidos.map(p => (
                                <option key={p.id} value={p.id}>
                                    P{p.orden || p.id} - vs {p.nombre_rival}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Pre-configured buttons */}
                    <div className="flex gap-2">
                        <div className="flex flex-col gap-1 w-1/2">
                            <span className="text-xs text-muted-foreground uppercase">Cancha Predeterminada 1</span>
                            <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="flex-1 bg-zinc-900" disabled={!configData?.cancha1} onClick={() => useDefaultConfig("cancha1")}>
                                    <Map className="w-3 h-3 mr-1" /> Usar
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 bg-zinc-900 border-primary/50 text-primary" disabled={!position} onClick={() => saveDefaultConfig("cancha1")}>
                                    <Save className="w-3 h-3 mr-1" /> Fíjar
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 w-1/2">
                            <span className="text-xs text-muted-foreground uppercase">Cancha Predeterminada 2</span>
                            <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="flex-1 bg-zinc-900" disabled={!configData?.cancha2} onClick={() => useDefaultConfig("cancha2")}>
                                    <Map className="w-3 h-3 mr-1" /> Usar
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 bg-zinc-900 border-primary/50 text-primary" disabled={!position} onClick={() => saveDefaultConfig("cancha2")}>
                                    <Save className="w-3 h-3 mr-1" /> Fíjar
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-zinc-900 rounded-md border border-primary/20 overflow-hidden relative">
                        {selectedPartido || true ? (
                            <MapContainer 
                                center={position ? [position.lat, position.lng] : [4.6097, -74.0817]} // Default Bogota
                                zoom={13} 
                                style={{ height: "100%", width: "100%" }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                                <LocationMarker position={position} setPosition={setPosition} />
                            </MapContainer>
                        ) : null}
                        
                        {!position && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-zinc-900/90 text-primary px-3 py-1 rounded-full text-xs font-bold shadow-md pointer-events-none">
                                Haz clic en el mapa para colocar el marcador
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-primary/10">
                        <Button 
                            onClick={handleSavePartido} 
                            disabled={!selectedPartido || !position || loading}
                            className="bg-primary text-zinc-950 font-bold hover:bg-primary/90"
                        >
                            {loading ? "Guardando..." : "Guardar Partido"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
