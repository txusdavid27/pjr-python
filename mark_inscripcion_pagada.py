"""
Script: mark_inscripcion_pagada.py
Marca deuda_inscripcion = 0 para los jugadores que confirmaron pago de inscripción.
Guarda el JSON actualizado y ejecuta recálculo de balance.
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DB_PATH = "db/jugador.json"

# Apodos de jugadores con ✅ en la lista del usuario
# (mapeo hecho manualmente según nombres en la DB)
PAGARON_APODOS = {
    "anto",        # Antonia Rivera Diaz ✅
    "stevan",      # Stevan Ramirez Cajamarca ✅
    "santi",       # Santiago Rodriguez Buitrago ✅
    "gsus",        # Jesus David Traslavina Fuentes ✅
    "borrero",     # Nicolás Borrero Cantor ✅
    "diego",       # Juan Diego Tirado ✅
    "juanse",      # Juan Sebastian Vargas Vanegas ✅
    "santa",       # Nicolás Santamaría Reyes ✅
    "memo",        # Guillermo Rodríguez Ramírez ✅
    "mono",        # Juan Pablo Bedoya Vallejo ✅
    "dani",        # Daniel Steeven Chaparro Villabon ✅
    "gustavo",     # Gustavo Monje ✅
    "alejo",       # CESAR ALEJANDRO DUITAMA GALINDO ✅
    "beja",        # Santiago Andres Bejarano Quevedo ✅
    "maldonado",   # Felipe Maldonado Díaz ✅
    "eddy",        # Eddy Carvajal ✅
    "colorado",    # Alejandro Colorado ✅
    "Cuéllar",     # Daniel Mauricio Cuéllar Manrique ✅
    "Juancho",     # Juan José Santoya Medina ✅ y Juan David Maldonado ✅ (mismo apodo, ambos pagaron)
    "Santy",       # Iván Santiago Ruiz Cardozo ✅
    "Mari",        # Mariana Serrano Pérez ✅
    "Juli",        # Juliana Morales Sánchez ✅
    "López ",      # Tomás López Ospina ✅ (con espacio como está en la DB)
}

with open(DB_PATH, "r", encoding="utf-8") as f:
    players = json.load(f)

updated = []
not_found = list(PAGARON_APODOS.copy())

for p in players:
    apodo = p.get("apodo", "")
    if apodo in PAGARON_APODOS:
        old = p.get("deuda_inscripcion", 0)
        p["deuda_inscripcion"] = 0
        print(f"  ✅ {p['nombre']} (apodo={apodo}) — inscripcion: {old} → 0")
        if apodo in not_found:
            not_found.remove(apodo)
    updated.append(p)

with open(DB_PATH, "w", encoding="utf-8") as f:
    json.dump(updated, f, indent=2, ensure_ascii=False)

print(f"\n✅ {DB_PATH} actualizado.")

# Recalcular todos los balances
from db_manager import db_manager
db_manager.recalculate_all_jugadores()
print("💰 Balances recalculados.")

print("\n--- RESUMEN ---")
print(f"Jugadores marcados como pagados: {len(PAGARON_APODOS)}")
if not_found:
    print(f"Apodos no encontrados (verificar): {not_found}")
else:
    print("Todos los apodos encontrados correctamente.")
