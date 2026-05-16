import json
import os
from db_manager import db_manager

jugadores = db_manager.get_jugadores()

for j in jugadores:
    if "deuda_uniformes" not in j or j["deuda_uniformes"] == 0:
        j["deuda_uniformes"] = 50000
    if "deuda_inscripcion" not in j or j["deuda_inscripcion"] == 0:
        j["deuda_inscripcion"] = 30000

db_manager._save("jugador", jugadores)
db_manager.recalculate_all_jugadores()
print("Updated responsibilities for all players!")
