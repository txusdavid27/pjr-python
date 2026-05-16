import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"

/** Convert a Google Drive share/view URL to a cacheable thumbnail URL.
 *  Falls back to the original URL or the logo placeholder if no id is found. */
export function getPhotoUrl(url: string | undefined | null): string {
    if (!url) return "/logo.png"
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (match) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200-h200`
    }
    return url
}

export type Player = {
    id: string
    nombre: string
    apodo: string
    numero: string
    nacimiento: string
    edad: number
    sexo: string
    activo: string
    lesiones: string
    caracter: string
    fortalezas: string
    debilidades: string
    velocidad: number
    resistencia: number
    fuerza: number
    cabeza: number
    tiro: number
    defenza: number
    ataque: number
    pase: number
    tiro_2: number
    goles: number
    amarillas: number
    rojas: number
    asistencias: number
    atajadas: number
    mejor_tiempo: string
    roles: string
    posicion: string
    posicion_secundaria: string
    foto: string
    contacto_emergencia: string
    contacto_propio: string
    documento: string
    apariciones: number
    puntualidad: number
    disputados: number
    partidos_pagos: number
    deuda_partidos: number
    amarillas_pagas: number
    rojas_pagas: number
    deuda_tarjetas: number
    deuda_uniformes: number
    deuda_inscripcion: number
    deuda_pasada?: number
    aporte_total: number
    deuda_total: number
    bonos: number
    pares_de_amarillas: number
    arco_cero: number
    balance_neto: number
    entrenamientos: number

    // Computed/Legacy
    name: string
    balance: string | number // Allow both for compatibility during transition
    photo: string
}

export const columns = (onViewDetails: (player: Player) => void): ColumnDef<Player>[] => [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "photo",
        header: "Foto",
        cell: ({ row }) => {
            const isRotated = row.getValue("nombre") === "Tomás López Ospina" || row.getValue("nombre") === "Iván Santiago Ruiz Cardozo";
            const src = (row.getValue("photo") as string) || "/logo.png"
            return (
                <img
                    src={src}
                    alt={row.getValue("nombre")}
                    className={`h-10 w-10 rounded-full object-cover border bg-zinc-800 ${isRotated ? "rotate-90" : ""}`}
                    onError={(e) => {
                        const t = e.currentTarget
                        if (!t.src.endsWith("/logo.png")) t.src = "/logo.png"
                    }}
                />
            )
        },
        enableSorting: false,
    },
    {
        accessorKey: "nombre",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Nombre
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <div className="font-medium">{row.getValue("nombre")}</div>,
    },
    {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
            const val = row.original.balance
            const balance = typeof val === 'string' ? parseFloat(val) : val
            let status = "Al Día"
            let color = "text-yellow-400 bg-yellow-900/40 border border-yellow-700/50"

            if (balance > 0) {
                status = "A Favor"
                color = "text-green-400 bg-green-900/40 border border-green-700/50"
            } else if (balance < 0) {
                status = "Con Deuda"
                color = "text-red-400 bg-red-950/60 border border-red-800/50"
            }

            return (
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase ${color} shadow-sm backdrop-blur-sm`}>
                    {status}
                </span>
            )
        },
    },
    {
        accessorKey: "balance",
        header: () => <div className="text-right">Saldo General</div>,
        cell: ({ row }) => {
            const val = row.getValue("balance") as string | number
            const amount = typeof val === 'string' ? parseFloat(val) : val
            const formatted = new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: "COP",
                maximumFractionDigits: 0
            }).format(amount)

            const color = amount < 0 ? "text-red-500 font-bold" : amount > 0 ? "text-green-400 font-bold" : "text-primary/70 font-medium"

            return <div className={`text-right ${color} tracking-wide`}>{formatted}</div>
        },
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const player = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(player.nombre)}
                        >
                            Copiar Nombre
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onViewDetails(player)}>
                            Ver Detalles
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
