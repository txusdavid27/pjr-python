import math
import os
import threading
import requests
import smtplib
import glob
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
from db_manager import db_manager, set_email_notifier

load_dotenv()

app = Flask(__name__, static_folder="frontend/dist")
PORT = int(os.environ.get("PORT", 5002))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(BASE_DIR, "photos")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Radius of earth in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c * 1000 # returns meters

if not os.path.exists(PHOTOS_DIR):
    os.makedirs(PHOTOS_DIR)

def _extract_drive_id(url: str) -> str | None:
    """Extract the Google Drive file ID from any known Drive URL format."""
    import re
    patterns = [
        r"[?&]id=([a-zA-Z0-9_-]+)",          # uc?export=view&id=XXX
        r"/d/([a-zA-Z0-9_-]+)/",              # /d/XXX/view
        r"thumbnail\?id=([a-zA-Z0-9_-]+)",   # thumbnail?id=XXX
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None


def _normalize_filename(nombre: str) -> str:
    """Turn a player name into a safe lowercase filename."""
    import unicodedata, re
    nfkd = unicodedata.normalize('NFKD', nombre)
    ascii_str = nfkd.encode('ascii', 'ignore').decode('ascii')
    safe = re.sub(r'[^a-z0-9]+', '_', ascii_str.lower()).strip('_')
    return safe + ".jpg" if safe else "default.jpg"


def _sync_one_photo(player: dict) -> None:
    """Download a single player photo if missing or stale."""
    foto_raw = player.get("foto", "")
    nombre   = player.get("nombre", "")
    if not foto_raw or not nombre:
        return

    file_id = _extract_drive_id(foto_raw)
    if not file_id:
        return

    filename = _normalize_filename(nombre)
    filepath = os.path.join(PHOTOS_DIR, filename)

    # Only download if missing (re-download is triggered by deleting the file)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 1024:
        return

    thumb_url = f"https://drive.google.com/thumbnail?id={file_id}&sz=w400-h400"
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }
    try:
        resp = requests.get(thumb_url, headers=headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        # Reject if Google returned an HTML error page
        ct = resp.headers.get("Content-Type", "")
        if "image" not in ct:
            print(f"  ⚠️ Not an image for {nombre}: {ct}")
            return
        with open(filepath, "wb") as f:
            f.write(resp.content)
        print(f"  ✅ Saved photo: {filename}")
    except Exception as e:
        print(f"  ❌ Failed for {nombre}: {e}")


def sync_photos_loop() -> None:
    """Background daemon: only downloads photos missing from /photos every 60 seconds."""
    import time
    while True:
        try:
            players = db_manager.get_jugadores()
            missing = [
                p for p in players
                if not os.path.exists(
                    os.path.join(PHOTOS_DIR, _normalize_filename(p.get("nombre", "")))
                ) or os.path.getsize(
                    os.path.join(PHOTOS_DIR, _normalize_filename(p.get("nombre", "")))
                ) <= 1024
            ]
            if missing:
                print(f"📸 {len(missing)} foto(s) faltantes — descargando...")
                for p in missing:
                    _sync_one_photo(p)
        except Exception as e:
            print(f"❌ Photo sync error: {e}")
        time.sleep(60)


def sync_balances_loop() -> None:
    """Background daemon: recalculates all balances every 30 seconds."""
    import time
    while True:
        try:
            db_manager.recalculate_all_jugadores()
        except Exception as e:
            print(f"❌ Balance sync error: {e}")
        time.sleep(30)


class DbEmailNotifier:
    """
    Envía un correo con todos los archivos JSON de la DB cada vez que
    haya un cambio. El envío se demora 60s (debounce) para agrupar
    múltiples cambios seguidos en un solo correo.
    """
    DEBOUNCE_SECONDS = 60
    DEST_EMAIL   = "futbolpjr@gmail.com"
    SENDER_EMAIL = "jedatrasfu@gmail.com"
    SENDER_PASS  = "lqnp epty ovdg reki"
    DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db")

    def __init__(self):
        self._timer = None
        self._lock = threading.Lock()
        self.sender_email = self.SENDER_EMAIL
        self.sender_pass  = self.SENDER_PASS

    def schedule(self):
        """Reinicia el timer de debounce cada vez que hay un cambio."""
        with self._lock:
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self.DEBOUNCE_SECONDS, self._send)
            self._timer.daemon = True
            self._timer.start()

    def _send(self):
        try:
            msg = MIMEMultipart()
            msg["From"]    = self.sender_email
            msg["To"]      = self.DEST_EMAIL
            msg["Subject"] = f"📦 PJR DB Backup — {datetime.now().strftime('%Y-%m-%d %H:%M')}"

            body = (
                f"Copia de seguridad automática de la base de datos PJR FC.\n"
                f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                "Se adjuntan todos los archivos JSON de la base de datos."
            )
            msg.attach(MIMEText(body, "plain", "utf-8"))

            for filepath in sorted(glob.glob(os.path.join(self.DB_DIR, "*.json"))):
                filename = os.path.basename(filepath)
                with open(filepath, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
                msg.attach(part)

            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
                server.login(self.sender_email, self.sender_pass)
                server.sendmail(self.sender_email, self.DEST_EMAIL, msg.as_string())

            print(f"📧 DB backup enviado a {self.DEST_EMAIL}")
        except Exception as e:
            print(f"❌ Error enviando backup por email: {e}")



@app.route("/", defaults={'path': ''})
@app.route("/<path:path>")
def serve(path):
    # Try serving static files, otherwise fallback to index.html for React Router
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route("/photos/<path:filename>")
def serve_photo(filename):
    return send_from_directory(PHOTOS_DIR, filename, max_age=86400)

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    
    valid_user = os.environ.get("ADMIN_USER", "admin")
    valid_pass = os.environ.get("ADMIN_PASS", "admin123")
    
    if username == valid_user and password == valid_pass:
        return jsonify({"success": True, "token": "true"})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route("/api/crud/<table_name>", methods=["GET"])
def crud_get_all(table_name):
    try:
        if table_name == "jugador":
            data = db_manager.get_jugadores()
        else:
            data = db_manager.get_table(table_name)
        return jsonify(data)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/api/crud/<table_name>/<int:record_id>", methods=["GET"])
def crud_get_one(table_name, record_id):
    try:
        record = db_manager.get_record(table_name, record_id)
        if record:
            return jsonify({"success": True, "data": record})
        return jsonify({"success": False, "message": "Not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/api/crud/<table_name>", methods=["POST"])
def crud_create(table_name):
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
    try:
        if isinstance(data, list):
            ids = []
            for item in data:
                ids.append(db_manager.create_record(table_name, item))
            return jsonify({"success": True, "ids": ids})
        else:
            new_id = db_manager.create_record(table_name, data)
            return jsonify({"success": True, "id": new_id})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/api/crud/<table_name>/<int:record_id>", methods=["PUT"])
def crud_update(table_name, record_id):
    data = request.json or {}
    try:
        db_manager.update_record(table_name, record_id, data)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/api/crud/<table_name>/<int:record_id>", methods=["DELETE"])
def crud_delete(table_name, record_id):
    try:
        if table_name == "partido":
            db_manager.delete_partido_cascading(record_id)
        else:
            db_manager.delete_record(table_name, record_id)
        return jsonify({"success": True})
    except Exception as e:
        tb = traceback.format_exc()
        print(f"\n\u274c DELETE /{table_name}/{record_id} FAILED:\n{tb}")
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/api/check_in_match/<int:partido_id>", methods=["POST"])
def check_in_match(partido_id):
    data = request.json
    if not data or 'lat' not in data or 'lng' not in data or 'apodo' not in data:
        return jsonify({"success": False, "message": "Faltan datos de ubicación o apodo"}), 400

    lat = float(data['lat'])
    lng = float(data['lng'])
    apodo = data['apodo']

    # Coordenadas fijas de la sede PJR FC — radio de 1000 metros
    SEDE_LAT = 4.790718900374112
    SEDE_LNG = -74.0554481431427
    RADIO_METROS = 1000

    try:
        partido = db_manager.get_record("partido", partido_id)
        if not partido:
            return jsonify({"success": False, "message": "Partido no encontrado"}), 404

        if partido.get("primero_en_llegar"):
            if partido.get("primero_en_llegar") == apodo:
                return jsonify({"success": True, "message": "¡Ya eres el primero en llegar!"})
            return jsonify({"success": False, "message": f"Alguien más ya llegó primero: {partido.get('primero_en_llegar')}"}), 400

        distancia = haversine(lat, lng, SEDE_LAT, SEDE_LNG)
        if distancia <= RADIO_METROS:
            partido["primero_en_llegar"] = apodo
            db_manager.update_record("partido", partido_id, partido)
            return jsonify({"success": True, "message": "¡Felicidades! Eres el primero en llegar, ganaste el bono de $5.000."})
        else:
            return jsonify({"success": False, "message": f"Estás muy lejos de la sede. Distancia: {distancia:.0f} metros. Debes estar a menos de {RADIO_METROS}m."}), 400

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/api/bulk/sync_matrix", methods=["POST"])
def bulk_sync_matrix():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"success": False, "message": "Expected a list of changes"}), 400
        
    try:
        db_manager.sync_matrix_participaciones(data)
        return jsonify({"success": True, "message": "Matrix synchronized successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

if __name__ == "__main__":
    print(f"\U0001f680 Server running on http://localhost:{PORT}")
    print(f"\u26a1 Mode: Local JSON Database")
    print("\U0001f4f8 Starting background photo sync (every 60s)...")
    threading.Thread(target=sync_photos_loop, daemon=True).start()
    print("\U0001f4b0 Starting background balance sync (every 30s)...")
    threading.Thread(target=sync_balances_loop, daemon=True).start()
    print("\U0001f4e7 Setting up DB email backup notifier...")
    notifier = DbEmailNotifier()
    set_email_notifier(notifier)
    app.run(host="0.0.0.0", port=PORT, debug=True, use_reloader=False)
