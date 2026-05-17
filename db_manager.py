import os
import json
import threading
import re
import unicodedata

# Referencia al notificador de email (se inyecta desde app.py al iniciar)
_email_notifier = None

def set_email_notifier(notifier):
    global _email_notifier
    _email_notifier = notifier

class DatabaseManager:
    def __init__(self, db_dir="db"):
        self.db_dir = db_dir
        self.lock = threading.Lock()
        
        # Ensure directory exists
        if not os.path.exists(self.db_dir):
            os.makedirs(self.db_dir)
            
        self.tables = ["jugador", "partido", "participacion", "pago", "goles", "amonestacion", "matrix", "config", "pqrs"]
        
        for table in self.tables:
            filepath = os.path.join(self.db_dir, f"{table}.json")
            if not os.path.exists(filepath):
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump([], f)
                    
        # Asegurar que todas las tablas tengan un 'id' (migración en tiempo de ejecución)
        for table in self.tables:
            if table == "matrix": continue
            try:
                data = self._load(table)
                modified = False
                max_id = self._get_next_id(data, "id") - 1
                for row in data:
                    if "id" not in row or not row["id"]:
                        max_id += 1
                        row["id"] = max_id
                        modified = True
                if modified:
                    self._save(table, data)
            except Exception:
                pass

    def _load(self, table):
        filepath = os.path.join(self.db_dir, f"{table}.json")
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save(self, table, data):
        filepath = os.path.join(self.db_dir, f"{table}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        # Notificar cambio en la base de datos (debounced)
        if _email_notifier and table not in ("matrix",):
            _email_notifier.schedule()

    def _get_next_id(self, table_data, id_field="id"):
        if not table_data:
            return 1
        
        max_id = 0
        for row in table_data:
            try:
                # Try to parse ID to integer
                val = int(row.get(id_field, 0))
                if val > max_id:
                    max_id = val
            except (ValueError, TypeError):
                continue
                
        return max_id + 1

    # ==========================
    # UTILIDADES DE TEXTO / FOTO
    # ==========================
    def _normalize_text(self, text):
        if not text:
            return ""
        text = str(text)
        text = unicodedata.normalize('NFD', text).encode('ascii', 'ignore').decode("utf-8")
        text = re.sub(r'[^a-zA-Z0-9 ]', '', text)
        return text.strip().lower()

    def _convert_drive_url(self, url):
        if not url:
            return ""
        if re.match(r'^[a-zA-Z0-9_-]{20,}$', url):
            return f"https://drive.google.com/thumbnail?id={url}&sz=w1000"
        match1 = re.search(r'/file/d/([^/]+)/', url)
        if match1:
            return f"https://drive.google.com/thumbnail?id={match1.group(1)}&sz=w1000"
        match2 = re.search(r'id=([^&]+)', url)
        if match2:
            return f"https://drive.google.com/thumbnail?id={match2.group(1)}&sz=w1000"
        return url

    # ==========================
    # LECTURA DE JUGADORES
    # ==========================
    def get_jugadores(self):
        with self.lock:
            jugadores = self._load("jugador")
            
        # Formatear la data como lo espera el frontend (como lo hacía app.py)
        result = []
        for p in jugadores:
            # Re-asignar para compatibilidad
            p["name"] = p.get("nombre", "")
            
            # El balance neto puede venir como string o float
            try:
                bn = float(p.get("BALANCE_NETO", 0))
            except (ValueError, TypeError):
                bn = 0
                
            p["balance_neto"] = bn
            p["balance"] = bn
            
            # Fotos
            foto_raw = p.get("foto", "")
            drive_url = self._convert_drive_url(foto_raw)
            safe_name = self._normalize_text(p["nombre"])
            filename = re.sub(r'\s+', '_', safe_name) + ".jpg" if safe_name else "default.jpg"
            
            p["photo"] = f"/photos/{filename}"
            p["filename"] = filename
            p["driveUrl"] = drive_url
            p["foto_url_raw"] = foto_raw
            
            result.append(p)
            
        return result

    # ==========================
    # ESCRITURA (CRUD)
    # ==========================
    def add_pago(self, apodo, tipo, valor, medio, nota, id_partido):
        with self.lock:
            pagos = self._load("pago")
            new_id = self._get_next_id(pagos, "id")
            
            try:
                valor_num = int(float(valor))
            except:
                valor_num = 0
                
            try:
                id_partido_num = int(id_partido)
            except:
                id_partido_num = -1

            nuevo_pago = {
                "id": new_id,
                "apodo": apodo,
                "tipo": tipo,
                "valor": valor_num,
                "medio": medio,
                "nota": nota,
                "id_partido": id_partido_num
            }
            
            pagos.append(nuevo_pago)
            self._save("pago", pagos)
            
        # Recalcular fuera del lock para evitar deadlocks si el recalculo usa locks
        self.recalculate_jugador(apodo)
        return new_id

    def add_goles(self, apodo, id_partido, apodo_asistencia, minuto):
        with self.lock:
            goles = self._load("goles")
            nuevo_gol = {
                "apodo": apodo,
                "id_partido": int(id_partido) if id_partido else -1,
                "apodo_asistencia": apodo_asistencia,
                "minuto": int(minuto) if minuto else 0
            }
            goles.append(nuevo_gol)
            self._save("goles", goles)
            
        self.recalculate_jugador(apodo)
        if apodo_asistencia and apodo_asistencia not in ["nn", "-", "pendiente"]:
            self.recalculate_jugador(apodo_asistencia)

    def add_amonestaciones(self, apodo, color, id_partido, nota):
        with self.lock:
            amonestaciones = self._load("amonestacion")
            color_code = color
            if color.lower() == "amarilla": color_code = "A"
            if color.lower() == "roja": color_code = "R"
            
            nueva_amonestacion = {
                "apodo": apodo,
                "color": color_code,
                "id_partido": int(id_partido) if id_partido else -1,
                "nota": nota,
                "paga": 1 # Genera multa por defecto
            }
            amonestaciones.append(nueva_amonestacion)
            self._save("amonestacion", amonestaciones)
            
        self.recalculate_jugador(apodo)

    def add_participacion(self, id_partido, players, minutos):
        with self.lock:
            participaciones = self._load("participacion")
            
            for apodo in players:
                participaciones.append({
                    "id_partido": int(id_partido),
                    "apodo": apodo,
                    "rol": "",
                    "minutos": float(minutos) if minutos else 0.0,
                    "paga": 1 # Por defecto genera cobro de partido
                })
                
            self._save("participacion", participaciones)
            
        for apodo in players:
            self.recalculate_jugador(apodo)
            
        self.rebuild_matrix()

    # ==========================
    # CRUD GENÉRICO
    # ==========================
    def get_table(self, table_name):
        if table_name not in self.tables:
            raise ValueError(f"Table {table_name} not found")
        with self.lock:
            return self._load(table_name)

    def get_record(self, table_name, record_id):
        if table_name not in self.tables:
            raise ValueError(f"Table {table_name} not found")
        with self.lock:
            data = self._load(table_name)
            for row in data:
                if str(row.get("id")) == str(record_id):
                    return row
            return None

    def create_record(self, table_name, data_dict):
        if table_name == "matrix":
            raise ValueError("No se puede modificar la matrix directamente")
        if table_name not in self.tables:
            raise ValueError(f"Table {table_name} not found")
            
        with self.lock:
            data = self._load(table_name)
            new_id = self._get_next_id(data, "id")
            data_dict["id"] = new_id
            data.append(data_dict)
            self._save(table_name, data)
            
        # Recalcular si tiene apodo
        apodo = data_dict.get("apodo")
        if apodo:
            self.recalculate_jugador(apodo)
            
        apodo_asist = data_dict.get("apodo_asistencia")
        if apodo_asist and apodo_asist not in ["nn", "-", "pendiente"]:
            self.recalculate_jugador(apodo_asist)
            
        if table_name == "participacion":
            self.rebuild_matrix()
            
        return new_id

    def update_record(self, table_name, record_id, data_dict):
        if table_name == "matrix":
            raise ValueError("No se puede modificar la matrix directamente")
        if table_name not in self.tables:
            raise ValueError(f"Table {table_name} not found")
            
        old_apodo, old_apodo_asist = None, None
        new_apodo = data_dict.get("apodo")
        new_apodo_asist = data_dict.get("apodo_asistencia")
        
        with self.lock:
            data = self._load(table_name)
            updated = False
            for i, row in enumerate(data):
                if str(row.get("id")) == str(record_id):
                    old_apodo = row.get("apodo")
                    old_apodo_asist = row.get("apodo_asistencia")
                    data_dict["id"] = row.get("id") # Preservar ID original
                    data[i] = data_dict
                    updated = True
                    break
                    
            if not updated:
                raise ValueError(f"Record {record_id} not found")
            self._save(table_name, data)
            
        # Trigger recalculations
        apodos_to_recalc = set()
        for a in [old_apodo, new_apodo, old_apodo_asist, new_apodo_asist]:
            if a and a not in ["nn", "-", "pendiente"]:
                apodos_to_recalc.add(a)
                
        for a in apodos_to_recalc:
            self.recalculate_jugador(a)
            
        if table_name == "participacion" or table_name == "partido":
            self.rebuild_matrix()

    def delete_record(self, table_name, record_id):
        if table_name == "matrix":
            raise ValueError("No se puede modificar la matrix directamente")
        if table_name not in self.tables:
            raise ValueError(f"Table {table_name} not found")
            
        old_apodo, old_apodo_asist = None, None
        
        with self.lock:
            data = self._load(table_name)
            new_data = []
            deleted = False
            for row in data:
                if str(row.get("id")) == str(record_id):
                    old_apodo = row.get("apodo")
                    old_apodo_asist = row.get("apodo_asistencia")
                    deleted = True
                else:
                    new_data.append(row)
                    
            if not deleted:
                raise ValueError(f"Record {record_id} not found")
            self._save(table_name, new_data)
            
        # Trigger recalculations
        if old_apodo:
            self.recalculate_jugador(old_apodo)
        if old_apodo_asist and old_apodo_asist not in ["nn", "-", "pendiente"]:
            self.recalculate_jugador(old_apodo_asist)
            
        if table_name == "participacion" or table_name == "partido":
            self.rebuild_matrix()

    def delete_partido_cascading(self, partido_id):
        """
        Elimina un partido y en cascada todas sus participaciones.
        Luego recalcula la deuda de todos los jugadores afectados.
        """
        affected_apodos = set()

        with self.lock:
            # 1. Eliminar participaciones del partido
            participaciones = self._load("participacion")
            remaining_parts = []
            for p in participaciones:
                if str(p.get("id_partido")) == str(partido_id):
                    apodo = p.get("apodo")
                    if apodo:
                        affected_apodos.add(apodo)
                else:
                    remaining_parts.append(p)
            self._save("participacion", remaining_parts)

            # 2. Eliminar el partido
            partidos = self._load("partido")
            new_partidos = [p for p in partidos if str(p.get("id")) != str(partido_id)]
            if len(new_partidos) == len(partidos):
                raise ValueError(f"Partido {partido_id} not found")
            self._save("partido", new_partidos)

        # 3. Recalcular deuda de todos los jugadores afectados
        for apodo in affected_apodos:
            self.recalculate_jugador(apodo)

        # 4. Reconstruir la matrix
        self.rebuild_matrix()

    # ==========================
    # LÓGICA DE NEGOCIO
    # ==========================
    def _calc_single_jugador(self, jugador, participaciones, pagos, amonestaciones, goles, partidos):
        apodo = jugador.get("apodo")
        if not apodo: return False
        
        # 1. Participaciones
        part_jugador = [p for p in participaciones if p.get("apodo") == apodo]
        apariciones = len(part_jugador)
        disputados = len(part_jugador)
        
        # 2. Pagos
        pagos_jugador = [p for p in pagos if p.get("apodo") == apodo]
        aporte_total = sum(float(p.get("valor", 0)) for p in pagos_jugador)
        bonos = sum(float(p.get("valor", 0)) for p in pagos_jugador if p.get("tipo", "").lower() == "bono")
        
        # 3. Deuda de Partidos, Amistosos y Entrenamientos
        deuda_partidos = 0
        deuda_amistosos = 0
        deuda_entrenamientos = 0
        jugados_oficiales = 0
        
        for p in part_jugador:
            estado = str(p.get("estado", "1"))
            if estado == "2" or estado == "confirmado":
                continue # Confirmados no pagan todavía
                
            id_partido = p.get("id_partido")
            partido_obj = next((pt for pt in partidos if str(pt.get("id")) == str(id_partido)), None)
            
            tipo = "partido"
            cobro_base = 15000.0
            
            if partido_obj:
                tipo = str(partido_obj.get("tipo", "partido")).lower()
                try:
                    cobro_base = float(partido_obj.get("cobro", 15000) or 15000)
                except:
                    pass
            
            es_arquero = str(p.get("rol")).lower() == "arquero"
            
            if tipo == "entrenamiento":
                # Entrenamientos: No dividen, tarifa plena para todos
                deuda_entrenamientos += cobro_base
            else:
                # Amistosos y Oficiales: Arqueros dividen
                if es_arquero:
                    otros_arqueros = [other for other in participaciones if other.get("id_partido") == id_partido and str(other.get("rol")).lower() == "arquero" and str(other.get("estado", "1")) not in ["2", "confirmado"]]
                    num_arqueros = len(otros_arqueros) if otros_arqueros else 1
                    costo_actual = cobro_base / num_arqueros
                else:
                    costo_actual = cobro_base
                    
                if tipo == "amistoso":
                    deuda_amistosos += costo_actual
                else:
                    deuda_partidos += costo_actual
                    jugados_oficiales += 1
        
        # Retrocompatibilidad de partidos pagos
        partidos_pagos = jugados_oficiales
        
        # 4. Amonestaciones
        amon_jugador = [a for a in amonestaciones if a.get("apodo") == apodo]
        amarillas = len([a for a in amon_jugador if a.get("color") == "A"])
        rojas = len([a for a in amon_jugador if a.get("color") == "R"])
        amarillas_pagas = len([a for a in amon_jugador if a.get("color") == "A" and (str(a.get("paga", "")) == "1" or a.get("paga") == 1)])
        rojas_pagas = len([a for a in amon_jugador if a.get("color") == "R" and (str(a.get("paga", "")) == "1" or a.get("paga") == 1)])
        
        try: pares_de_amarillas = int(jugador.get("pares_de_amarillas", 0) or 0)
        except: pares_de_amarillas = 0
        
        deuda_tarjetas = amarillas * 5000 + rojas * 20000
        
        # 5. Goles y Asistencias
        goles_jugador = len([g for g in goles if g.get("apodo") == apodo])
        asistencias_jugador = len([g for g in goles if g.get("apodo_asistencia") == apodo])
        
        # 6. Bonos Adicionales
        partidos_mvp = len([p for p in partidos if p.get("mvp") == apodo])
        partidos_primero = len([p for p in partidos if p.get("primero_en_llegar") == apodo])
        
        try: arco_cero = int(jugador.get("arco_cero", 0) or 0)
        except: arco_cero = 0
        
        bonos += (goles_jugador * 5000)
        bonos += (arco_cero * 5000)
        bonos += (partidos_mvp * 5000)
        bonos += (partidos_primero * 5000)
        
        # 7. Deudas fijas / manuales
        try: deuda_uniformes = float(jugador.get("deuda_uniformes", 0) or 0)
        except: deuda_uniformes = 0
            
        try: deuda_inscripcion = float(jugador.get("deuda_inscripcion", 0) or 0)
        except: deuda_inscripcion = 0
        
        try: deuda_pasada = float(jugador.get("deuda_pasada", 0) or 0)
        except: deuda_pasada = 0
        
        try: abonado = float(jugador.get("abonado", 0) or 0)
        except: abonado = 0
        
        # 8. Totales
        deuda_total_positiva = deuda_partidos + deuda_amistosos + deuda_entrenamientos + deuda_tarjetas + deuda_uniformes + deuda_inscripcion + (pares_de_amarillas * 5000) + deuda_pasada
        balance_neto = aporte_total + abonado + bonos - deuda_total_positiva
        deuda_total = deuda_total_positiva # Positivo representa deuda en UI
        
        # Solo actualizamos si cambió algo para evitar writes inútiles, o actualizamos in-place
        cambios = False
        updates = {
            "apariciones": apariciones,
            "disputados": disputados,
            "partidos_pagos": partidos_pagos,
            "deuda_partidos": deuda_partidos,
            "deuda_amistosos": deuda_amistosos,
            "entrenamientos": deuda_entrenamientos,
            "amarillas": amarillas,
            "rojas": rojas,
            "amarillas_pagas": amarillas_pagas,
            "rojas_pagas": rojas_pagas,
            "deuda_tarjetas": deuda_tarjetas,
            "aporte_total": aporte_total,
            "bonos": bonos,
            "deuda_total": deuda_total,
            "BALANCE_NETO": balance_neto,
            "goles": goles_jugador,
            "asistencias": asistencias_jugador,
            "pares_de_amarillas": pares_de_amarillas,
            "arco_cero": arco_cero
        }
        
        for k, v in updates.items():
            if jugador.get(k) != v:
                jugador[k] = v
                cambios = True
                
        return cambios

    def recalculate_jugador(self, apodo):
        with self.lock:
            jugadores = self._load("jugador")
            participaciones = self._load("participacion")
            pagos = self._load("pago")
            amonestaciones = self._load("amonestacion")
            goles = self._load("goles")
            partidos = self._load("partido")
            
            jugador = next((j for j in jugadores if j.get("apodo") == apodo), None)
            if not jugador: return
            
            if self._calc_single_jugador(jugador, participaciones, pagos, amonestaciones, goles, partidos):
                self._save("jugador", jugadores)

    def recalculate_all_jugadores(self):
        with self.lock:
            jugadores = self._load("jugador")
            participaciones = self._load("participacion")
            pagos = self._load("pago")
            amonestaciones = self._load("amonestacion")
            goles = self._load("goles")
            partidos = self._load("partido")
            
            cambios_totales = False
            for jugador in jugadores:
                if self._calc_single_jugador(jugador, participaciones, pagos, amonestaciones, goles, partidos):
                    cambios_totales = True
                    
            if cambios_totales:
                self._save("jugador", jugadores)

    def sync_matrix_participaciones(self, changes):
        """
        changes: list of dicts with { "apodo": str, "id_partido": int, "action": "add" | "remove" }
        """
        with self.lock:
            participaciones = self._load("participacion")
            changed_apodos = set()
            
            for change in changes:
                apodo = change.get("apodo")
                id_partido = change.get("id_partido")
                action = change.get("action")
                
                if not apodo or not id_partido or not action:
                    continue
                    
                if action == "add" or action == "set":
                    # Check if exists
                    part = next((p for p in participaciones if p.get("apodo") == apodo and p.get("id_partido") == id_partido), None)
                    estado = change.get("estado", "1")
                    
                    if not part:
                        new_id = self._get_next_id(participaciones, "id")
                        participaciones.append({
                            "id": new_id,
                            "id_partido": id_partido,
                            "apodo": apodo,
                            "rol": "",
                            "minutos": 0,
                            "paga": 1,
                            "estado": estado
                        })
                        changed_apodos.add(apodo)
                    else:
                        if str(part.get("estado", "1")) != str(estado):
                            part["estado"] = estado
                            changed_apodos.add(apodo)
                
                elif action == "remove":
                    # Remove all matching
                    to_remove = [p for p in participaciones if p.get("apodo") == apodo and p.get("id_partido") == id_partido]
                    if to_remove:
                        participaciones = [p for p in participaciones if p not in to_remove]
                        changed_apodos.add(apodo)
            
            if changed_apodos:
                self._save("participacion", participaciones)
                
        # Rebuild matrix and recalculate outside the load lock to avoid nesting
        if changed_apodos:
            self.rebuild_matrix()
            for apodo in changed_apodos:
                self.recalculate_jugador(apodo)

    def rebuild_matrix(self):
        with self.lock:
            jugadores = self._load("jugador")
            participaciones = self._load("participacion")
            
            # Identificar todos los ids de partidos jugados
            ids_partidos = set()
            for p in participaciones:
                try:
                    ids_partidos.add(int(p.get("id_partido")))
                except:
                    pass
            ids_partidos = sorted(list(ids_partidos))
            
            nueva_matrix = []
            
            for j in jugadores:
                apodo = j.get("apodo")
                if not apodo:
                    continue
                    
                part_jugador = [p for p in participaciones if p.get("apodo") == apodo]
                
                # Para balance bruto, la participacion donde paga=1 significa que asistió e incurre en $15000 de costo
                jugados = len(part_jugador)
                estimado = jugados * 15000
                pagado_total = len([p for p in part_jugador if str(p.get("paga", "")) == "1" or p.get("paga") == 1])
                balance_bruto = (pagado_total * 15000) - estimado
                
                fila_matrix = {
                    "id": j.get("id"),
                    "nombre": j.get("nombre"),
                    "apodo": apodo,
                    "jugados": jugados,
                    "estimado": estimado,
                    "pagado_total": pagado_total,
                    "balance_bruto": balance_bruto
                }
                
                # Partidos dinámicos (0, 1 o 2)
                for id_p in ids_partidos:
                    part = next((p for p in part_jugador if int(p.get("id_partido", -1)) == id_p), None)
                    if part:
                        estado = str(part.get("estado", "1"))
                        participo = 2 if (estado == "2" or estado == "confirmado") else 1
                    else:
                        participo = 0
                        
                    fila_matrix[str(id_p)] = participo
                    
                nueva_matrix.append(fila_matrix)
                
            self._save("matrix", nueva_matrix)

# Singleton global instance
db_manager = DatabaseManager()
