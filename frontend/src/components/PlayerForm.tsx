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
import { Loader2, Upload, User } from "lucide-react"

type Mode = "add" | "edit"

interface PlayerFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    player?: any // null = add new, object = edit existing
    mode: Mode
    onSuccess: () => void
}

const POSITIONS = ["PO", "DC", "DL", "LC", "MD", "MI", "MO", "ED", "EI", "LD", "LD/LC"]

const FIELD_GROUPS = [
    {
        label: "Información Personal",
        fields: [
            { key: "nombre",      label: "Nombre Completo",      type: "text" },
            { key: "apodo",       label: "Apodo / Nickname",      type: "text" },
            { key: "nacimiento",  label: "Fecha de Nacimiento",   type: "date" },
            { key: "documento",   label: "Documento",             type: "text" },
            { key: "contacto_propio",     label: "Teléfono Propio",       type: "tel" },
            { key: "contacto_emergencia", label: "Contacto Emergencia",   type: "tel" },
        ]
    },
    {
        label: "Posición y Perfil",
        fields: [
            { key: "posicion",           label: "Posición Principal",   type: "select_pos" },
            { key: "posicion_secundaria", label: "Posición Secundaria", type: "select_pos" },
            { key: "fortalezas",  label: "Fortalezas",   type: "textarea" },
            { key: "debilidades", label: "Debilidades",  type: "textarea" },
            { key: "caracter",    label: "Carácter",     type: "text" },
            { key: "lesiones",    label: "Lesiones",     type: "text" },
        ]
    },
    {
        label: "Atributos (0-100)",
        fields: [
            { key: "velocidad",   label: "Velocidad",   type: "number" },
            { key: "resistencia", label: "Resistencia", type: "number" },
            { key: "fuerza",      label: "Fuerza",      type: "number" },
            { key: "cabeza",      label: "Cabeza",      type: "number" },
            { key: "tiro",        label: "Tiro",        type: "number" },
            { key: "defenza",     label: "Defensa",     type: "number" },
            { key: "ataque",      label: "Ataque",      type: "number" },
            { key: "pase",        label: "Pase",        type: "number" },
        ]
    },
    {
        label: "Responsabilidades Iniciales",
        fields: [
            { key: "deuda_uniformes",   label: "Deuda Uniforme",    type: "number" },
            { key: "deuda_inscripcion", label: "Deuda Inscripción", type: "number" },
        ]
    }
]

export function PlayerForm({ open, onOpenChange, player, mode, onSuccess }: PlayerFormProps) {
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState(false)
    const [error, setError] = React.useState("")
    const [form, setForm] = React.useState<Record<string, any>>({})
    const [photoPreview, setPhotoPreview] = React.useState<string>("")
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Initialize form when opening
    React.useEffect(() => {
        if (open) {
            setError("")
            setSuccess(false)
            if (mode === "edit" && player) {
                setForm({ ...player })
                setPhotoPreview(player.foto || "")
            } else {
                setForm({
                    activo: "Y",
                    sexo: "caballero",
                    deuda_uniformes: 50000,
                    deuda_inscripcion: 30000,
                })
                setPhotoPreview("")
            }
        }
    }, [open, mode, player])

    const handleField = (key: string, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        // Preview locally
        const reader = new FileReader()
        reader.onloadend = () => {
            const base64 = reader.result as string
            setPhotoPreview(base64)
            setForm(prev => ({ ...prev, foto: base64 }))
        }
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.nombre?.trim()) { setError("El nombre es obligatorio."); return }
        if (!form.apodo?.trim()) { setError("El apodo es obligatorio."); return }

        setLoading(true)
        setError("")
        try {
            let res: Response
            if (mode === "add") {
                res = await fetch("/api/crud/jugador", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form)
                })
            } else {
                res = await fetch(`/api/crud/jugador/${player.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...player, ...form })
                })
            }
            if (!res.ok) throw new Error("Error al guardar")
            setSuccess(true)
            setTimeout(() => {
                onOpenChange(false)
                onSuccess()
            }, 800)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "flex h-9 w-full rounded-md border border-input bg-zinc-900 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    const selectClass = "flex h-9 w-full rounded-md border border-input bg-zinc-900 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-zinc-950 border-primary/30">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {mode === "add" ? "Agregar Jugador" : `Editar: ${player?.nombre || ""}`}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "add"
                            ? "Completa la información del nuevo jugador."
                            : "Edita los campos que desees actualizar."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-2">
                    {/* ── Photo Upload ── */}
                    <div className="flex items-center gap-5">
                        <div
                            className="w-20 h-20 rounded-2xl border-2 border-primary/30 bg-zinc-900 overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/70 transition-colors shrink-0"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoPreview ? (
                                <img src={photoPreview} className="w-full h-full object-cover" alt="preview" />
                            ) : (
                                <User className="h-8 w-8 text-muted-foreground" />
                            )}
                        </div>
                        <div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-4 w-4" />
                                {photoPreview ? "Cambiar foto" : "Subir foto"}
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG o GIF. Máx 5MB.</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                        />
                    </div>

                    {/* ── Field Groups ── */}
                    {FIELD_GROUPS.map(group => (
                        <div key={group.label} className="space-y-3">
                            <h4 className="text-xs font-bold text-primary/70 uppercase tracking-widest border-b border-primary/20 pb-1">
                                {group.label}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.fields.map(f => (
                                    <div key={f.key} className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                                        {f.type === "textarea" ? (
                                            <textarea
                                                className={`${inputClass} h-16 resize-none py-2`}
                                                value={form[f.key] || ""}
                                                onChange={e => handleField(f.key, e.target.value)}
                                            />
                                        ) : f.type === "select_pos" ? (
                                            <select
                                                className={selectClass}
                                                value={form[f.key] || ""}
                                                onChange={e => handleField(f.key, e.target.value)}
                                            >
                                                <option value="">Selecciona...</option>
                                                {POSITIONS.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                                className="h-9 bg-zinc-900 border-input text-sm"
                                                value={form[f.key] ?? ""}
                                                min={f.type === "number" && group.label.includes("Atributos") ? 0 : undefined}
                                                max={f.type === "number" && group.label.includes("Atributos") ? 120 : undefined}
                                                onChange={e => handleField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {error && (
                        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                            ¡Guardado correctamente!
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-zinc-950 pb-1">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || success}
                            className="bg-primary hover:bg-primary/90 text-zinc-950 font-bold gap-2"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {mode === "add" ? "Crear Jugador" : "Guardar Cambios"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
