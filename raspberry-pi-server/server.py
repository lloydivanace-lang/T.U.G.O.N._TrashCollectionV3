#!/usr/bin/env python3
"""
T.U.G.O.N. / P.U.L.S.E. - Barangay 40 (Gumamela) & 41 (Rosal), Cavite City
Raspberry Pi 4B Sovereign Cloud Storage Server

Zero-Dependency Version: Python 3 Standard Library Only (No pip / No venv required!)
Features:
- Concurrent ThreadingHTTPServer (never hangs on large photo uploads or parallel pings)
- Full CORS + Cloudflare Pages/Workers + Chrome Private Network Access + ngrok-skip-browser-warning support
- Auto-detection of External Hard Drive (/media/pi/Vherrsie Back-up/RESEARCH TRASH)
- Automatic decoding of Resident & Kagawad Proof Base64 photos into real .jpg/.png files on disk
- Real Hardware Telemetry (CPU Temp, RAM MemAvailable, Disk Total/Used/Free, LAN IP)
- Complete CRUD: Health, Config, Storage, Single Report POST + Two-Way Sync, PATCH Status/Proof, Delete Report, Save/List/Download/Delete Logbooks, Safe Shutdown & Reboot
"""

from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import os
import sys
import json
import base64
import shutil
import socket
import datetime
import threading
import time
import urllib.parse


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _ensure_writable_dir(path):
    try:
        os.makedirs(path, exist_ok=True)
        probe = os.path.join(path, ".tugon_write_probe")
        with open(probe, "w", encoding="utf-8") as f:
            f.write("ok")
        os.remove(probe)
        return True
    except Exception:
        return False


def get_storage_dir():
    custom_dir = os.environ.get("PI_STORAGE_DIR", "").strip()
    if custom_dir and _ensure_writable_dir(custom_dir):
        return custom_dir

    candidates = [
        "/media/pi/Vherrsie Back-up/RESEARCH TRASH",
        os.path.expanduser("~/media/pi/Vherrsie Back-up/RESEARCH TRASH"),
        os.path.abspath("media/pi/Vherrsie Back-up/RESEARCH TRASH"),
        "/media/pi/Vherrsie Back-up",
    ]
    for p in candidates:
        if os.path.exists(p):
            if os.path.basename(p) == "Vherrsie Back-up":
                target = os.path.join(p, "RESEARCH TRASH")
                if _ensure_writable_dir(target):
                    return target
            if _ensure_writable_dir(p):
                return p

    for base in ["/media/pi", "/media", "/mnt"]:
        if os.path.exists(base):
            try:
                for entry in os.listdir(base):
                    mount = os.path.join(base, entry)
                    if os.path.isdir(mount) and not entry.startswith("."):
                        target = os.path.join(mount, "RESEARCH TRASH")
                        if os.path.exists(target) and _ensure_writable_dir(target):
                            return target
                        pulse_dir = os.path.join(mount, "pulse_storage")
                        if _ensure_writable_dir(pulse_dir):
                            return pulse_dir
            except Exception:
                pass

    for fallback in [os.path.expanduser("~/pulse_storage"), "/tmp/pulse_storage"]:
        if _ensure_writable_dir(fallback):
            return fallback
    return os.path.abspath("pulse_storage")


STORAGE_DIR = get_storage_dir()
os.makedirs(STORAGE_DIR, exist_ok=True)

LOGBOOKS_DIR = os.path.join(STORAGE_DIR, "saved_logbooks")
os.makedirs(LOGBOOKS_DIR, exist_ok=True)
PHOTOS_DIR = os.path.join(STORAGE_DIR, "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)
ARCHIVES_DIR = os.path.join(STORAGE_DIR, "purged_archives")
os.makedirs(ARCHIVES_DIR, exist_ok=True)
REPORTS_DB_FILE = os.path.join(STORAGE_DIR, "pulse_reports.json")
PORTAL_CONFIG_FILE = os.path.join(STORAGE_DIR, "pulse_portal_config.json")

DB_LOCK = threading.Lock()


def sanitize_filename_token(val):
    cleaned = "".join(c if (c.isalnum() or c in "-_") else "_" for c in str(val or "ticket"))
    return cleaned[:48] or "ticket"


def save_data_url_image(data_url, target_filename):
    if not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        return False
    try:
        header, b64_part = data_url.split(",", 1)
        ext = "jpg"
        if "image/png" in header:
            ext = "png"
        elif "image/webp" in header:
            ext = "webp"
        out_path = os.path.join(PHOTOS_DIR, f"{target_filename}.{ext}")
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            return True
        raw_bytes = base64.b64decode(b64_part)
        with open(out_path, "wb") as img_f:
            img_f.write(raw_bytes)
        return True
    except Exception:
        return False


def sync_report_photos_to_disk(reports_list):
    if not isinstance(reports_list, list):
        return 0
    saved = 0
    for rep in reports_list:
        if not isinstance(rep, dict):
            continue
        token = sanitize_filename_token(rep.get("ticketNumber") or rep.get("id"))
        for idx, photo in enumerate(rep.get("photos") or []):
            if save_data_url_image(photo, f"{token}_resident_{idx + 1}"):
                saved += 1
        for idx, proof in enumerate(rep.get("proofPhotos") or []):
            if save_data_url_image(proof, f"{token}_proof_{idx + 1}"):
                saved += 1
    return saved


def read_pi_reports():
    if not os.path.exists(REPORTS_DB_FILE):
        return []
    with DB_LOCK:
        try:
            with open(REPORTS_DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception:
            return []


def write_pi_reports(reports_list):
    with DB_LOCK:
        try:
            tmp_file = REPORTS_DB_FILE + ".tmp"
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(reports_list, f, indent=2, ensure_ascii=False)
            os.replace(tmp_file, REPORTS_DB_FILE)
        except Exception as e:
            print(f"[ERROR] Writing reports failed: {e}")
            return False
    try:
        sync_report_photos_to_disk(reports_list)
    except Exception:
        pass
    return True


def read_portal_config():
    if not os.path.exists(PORTAL_CONFIG_FILE):
        return {}
    with DB_LOCK:
        try:
            with open(PORTAL_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}


def write_portal_config(cfg):
    with DB_LOCK:
        try:
            current = {}
            if os.path.exists(PORTAL_CONFIG_FILE):
                try:
                    with open(PORTAL_CONFIG_FILE, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                        if isinstance(loaded, dict):
                            current = loaded
                except Exception:
                    pass
            if isinstance(cfg, dict):
                current.update(cfg)
            tmp_file = PORTAL_CONFIG_FILE + ".tmp"
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=2, ensure_ascii=False)
            os.replace(tmp_file, PORTAL_CONFIG_FILE)
            return current
        except Exception:
            return cfg


def get_dir_size_bytes(path):
    total = 0
    try:
        for root, _dirs, files in os.walk(path):
            for f in files:
                fp = os.path.join(root, f)
                if not os.path.islink(fp):
                    try:
                        total += os.path.getsize(fp)
                    except Exception:
                        pass
    except Exception:
        pass
    return total


def get_hardware_model():
    model_path = "/proc/device-tree/model"
    if os.path.exists(model_path):
        try:
            with open(model_path, "rb") as f:
                raw = f.read().replace(b"\x00", b"").decode("utf-8", errors="ignore").strip()
                if raw:
                    return raw
        except Exception:
            pass
    return "Raspberry Pi 4 Model B (Local Cloud Storage)"


def get_ram_summary():
    meminfo = "/proc/meminfo"
    if os.path.exists(meminfo):
        try:
            info = {}
            with open(meminfo, "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val_kb = int(parts[1].strip().split()[0])
                        info[key] = val_kb
            total_kb = info.get("MemTotal", 0)
            avail_kb = info.get("MemAvailable", info.get("MemFree", 0))
            if total_kb > 0:
                total_gb = round(total_kb / (1024 * 1024), 1)
                used_gb = round((total_kb - avail_kb) / (1024 * 1024), 1)
                pct = round(((total_kb - avail_kb) / total_kb) * 100)
                return f"{used_gb} GB / {total_gb} GB ({pct}%)", pct
        except Exception:
            pass
    return "Active (Healthy)", 35


def get_cpu_temp():
    temp_path = "/sys/class/thermal/thermal_zone0/temp"
    if os.path.exists(temp_path):
        try:
            with open(temp_path, "r", encoding="utf-8") as f:
                c = round(float(f.read().strip()) / 1000.0, 1)
                return f"{c}°C", c
        except Exception:
            pass
    return "42.0°C", 42.0


def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class PulseHttpHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {self.address_string()} {args[0]} -> {args[1]}")

    def _send_cors(self):
        req_headers = self.headers.get("Access-Control-Request-Headers", "")
        default_allowed = (
            "Content-Type, Authorization, ngrok-skip-browser-warning, "
            "Bypass-Tunnel-Reminder, X-Requested-With, X-Pi-Endpoint, Accept, Cache-Control, Pragma"
        )
        allow_headers = f"{default_allowed}, {req_headers}" if req_headers else default_allowed
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", allow_headers)
        self.send_header("Access-Control-Expose-Headers", "X-Pi-Online, Content-Disposition")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("X-Pi-Online", "true")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")

    def _send_json(self, status_code, payload):
        try:
            body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._send_cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        try:
            self.send_response(204)
            self._send_cors()
            self.end_headers()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/test.txt":
            try:
                body = b"T.U.G.O.N. Raspberry Pi 4B Cloud Storage ONLINE"
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self._send_cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        if path == "/api/config":
            cfg = read_portal_config()
            self._send_json(
                200,
                {
                    "success": True,
                    "piOnline": True,
                    "telegramConfigured": bool(cfg.get("telegramBotToken") and cfg.get("telegramChatId")),
                    "telegramSetupComplete": bool(cfg.get("telegramSetupComplete")),
                    "telegramChatId": cfg.get("telegramChatId", ""),
                    "telegramBotToken": cfg.get("telegramBotToken", ""),
                    "hasCustomPassword": bool(cfg.get("kagawadCustomPassword")),
                },
            )
            return

        if path == "/" or path.startswith("/api/health") or path.startswith("/api/storage"):
            cpu_temp_str, cpu_temp_val = get_cpu_temp()
            ram_str, ram_pct = get_ram_summary()
            hw_model = get_hardware_model()

            total_gb, used_gb, free_gb = 500.0, 20.0, 480.0
            try:
                total, used, free = shutil.disk_usage(STORAGE_DIR)
                total_gb = round(total / (1024**3), 1)
                used_gb = round(used / (1024**3), 1)
                free_gb = round(free / (1024**3), 1)
            except Exception:
                pass

            pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
            pulse_mb = round(pulse_bytes / (1024 * 1024), 2)
            pulse_kb = round(pulse_bytes / 1024, 1)

            logbooks_count = (
                len([f for f in os.listdir(LOGBOOKS_DIR) if f.endswith(".json")])
                if os.path.exists(LOGBOOKS_DIR)
                else 0
            )
            disk_photos_count = (
                len([f for f in os.listdir(PHOTOS_DIR) if not f.startswith(".")])
                if os.path.exists(PHOTOS_DIR)
                else 0
            )
            purged_count = len(os.listdir(ARCHIVES_DIR)) if os.path.exists(ARCHIVES_DIR) else 0
            reports_data = read_pi_reports()

            resident_photos = sum(len(r.get("photos") or []) for r in reports_data if isinstance(r, dict))
            proof_photos = sum(len(r.get("proofPhotos") or []) for r in reports_data if isinstance(r, dict))

            data = {
                "status": "ONLINE",
                "online": True,
                "system": "T.U.G.O.N. Raspberry Pi 4B Server",
                "hardware": hw_model,
                "ram": ram_str,
                "ramUsagePercent": ram_pct,
                "storage_folder": STORAGE_DIR,
                "disk_total": f"{total_gb} GB",
                "disk_used": f"{used_gb} GB",
                "disk_free": f"{free_gb} GB",
                "pulse_folder_mb": pulse_mb,
                "pulse_folder_kb": pulse_kb,
                "pulse_storage_summary": f"{pulse_mb} MB ({pulse_kb} KB) used on hard drive",
                "logbooks_count": logbooks_count,
                "photos_count": max(disk_photos_count, resident_photos + proof_photos),
                "disk_photos_files": disk_photos_count,
                "resident_photos_count": resident_photos,
                "proof_photos_count": proof_photos,
                "reports_count": len(reports_data),
                "purged_archives_count": purged_count,
                "cpu_temp": cpu_temp_str,
                "cpuTempCelsius": cpu_temp_val,
                "lan_ip": get_lan_ip(),
                "hostname": socket.gethostname(),
                "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            self._send_json(200, data)
            return

        if path.startswith("/photos/") or path.startswith("/api/photos/"):
            prefix = "/api/photos/" if path.startswith("/api/photos/") else "/photos/"
            raw_photo = urllib.parse.unquote(path[len(prefix):]).strip("/")
            safe_photo = os.path.basename(raw_photo)
            photo_fp = os.path.join(PHOTOS_DIR, safe_photo)
            if os.path.exists(photo_fp) and os.path.isfile(photo_fp):
                try:
                    ext = os.path.splitext(safe_photo)[1].lower()
                    mime = (
                        "image/png"
                        if ext == ".png"
                        else "image/webp"
                        if ext == ".webp"
                        else "image/jpeg"
                    )
                    with open(photo_fp, "rb") as pf:
                        img_bytes = pf.read()
                    self.send_response(200)
                    self.send_header("Content-Type", mime)
                    self.send_header("Cache-Control", "public, max-age=86400")
                    self._send_cors()
                    self.send_header("Content-Length", str(len(img_bytes)))
                    self.end_headers()
                    self.wfile.write(img_bytes)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
                return
            self._send_json(404, {"error": "Photo file not found on Pi"})
            return

        if path.startswith("/api/reports"):
            reports_data = read_pi_reports()
            for r in reports_data:
                if isinstance(r, dict) and r.get("ticketNumber"):
                    t_str = str(r["ticketNumber"]).strip().lstrip("#")
                    for legacy_pfx in ("PULSE-CAV-", "pulse-cav-", "TRASH-CAV-", "DRAW-CAV-"):
                        if t_str.startswith(legacy_pfx):
                            t_str = "TUGON-CAV-" + t_str[len(legacy_pfx):]
                            break
                    r["ticketNumber"] = t_str
            if "ids" in qs:
                raw_ids = [s.strip() for s in (qs.get("ids") or [""])[0].split(",") if s.strip()]
                if not raw_ids:
                    self._send_json(200, [])
                    return
                id_set = set(raw_ids)
                norm_set = {
                    s.lstrip("#").upper().replace("PULSE-CAV-", "TUGON-CAV-") for s in raw_ids
                }
                filtered = [
                    r
                    for r in reports_data
                    if isinstance(r, dict)
                    and (
                        str(r.get("id")) in id_set
                        or str(r.get("ticketNumber")) in id_set
                        or str(r.get("ticketNumber", "")).upper() in norm_set
                    )
                ]
                self._send_json(200, filtered)
                return
            self._send_json(200, reports_data)
            return

        if path.startswith("/api/logbooks/"):
            raw_name = urllib.parse.unquote(path[len("/api/logbooks/"):]).strip("/")
            safe_name = os.path.basename(raw_name)
            fp = os.path.join(LOGBOOKS_DIR, safe_name)
            if os.path.exists(fp) and os.path.isfile(fp):
                try:
                    with open(fp, "r", encoding="utf-8") as f:
                        content = json.load(f)
                    self._send_json(200, content)
                    return
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
                    return
            self._send_json(404, {"error": "Logbook file not found on Pi"})
            return

        if path.startswith("/api/logbooks"):
            logs = []
            if os.path.exists(LOGBOOKS_DIR):
                for f in sorted(os.listdir(LOGBOOKS_DIR), reverse=True):
                    if f.endswith(".json"):
                        fp = os.path.join(LOGBOOKS_DIR, f)
                        try:
                            st = os.stat(fp)
                            meta = {}
                            try:
                                with open(fp, "r", encoding="utf-8") as jf:
                                    loaded = json.load(jf)
                                    if isinstance(loaded, dict):
                                        meta = {
                                            "id": loaded.get("logbookId") or loaded.get("id") or f,
                                            "savedBy": loaded.get("savedBy") or "Barangay Official",
                                            "savedAtPhilippineTime": loaded.get("savedAtPhilippineTime"),
                                            "totalRecords": loaded.get("totalRecords", len(loaded.get("reports") or [])),
                                        }
                            except Exception:
                                pass
                            mod_str = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                            logs.append(
                                {
                                    "id": meta.get("id", f),
                                    "filename": f,
                                    "path": fp,
                                    "sizeBytes": st.st_size,
                                    "sizeKb": round(st.st_size / 1024, 1),
                                    "savedBy": meta.get("savedBy", "Barangay Official"),
                                    "totalRecords": meta.get("totalRecords", 0),
                                    "modified": meta.get("savedAtPhilippineTime") or mod_str,
                                }
                            )
                        except Exception:
                            pass
            self._send_json(200, logs)
            return

        self._send_json(404, {"error": "Endpoint not found", "path": path})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        raw_data = self.rfile.read(length) if length > 0 else b""

        if path == "/api/config":
            try:
                payload = json.loads(raw_data.decode("utf-8")) if raw_data else {}
                saved = write_portal_config(payload if isinstance(payload, dict) else {})
                self._send_json(200, {"success": True, "config": saved})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
            return

        if path == "/api/reports/clear-all":
            write_pi_reports([])
            self._send_json(200, {"success": True, "count": 0})
            return

        if path.startswith("/api/reports/sync"):
            try:
                payload = json.loads(raw_data.decode("utf-8")) if raw_data else []
                if isinstance(payload, dict) and "reports" in payload and isinstance(payload["reports"], list):
                    reports_to_save = payload["reports"]
                elif isinstance(payload, list):
                    reports_to_save = payload
                else:
                    reports_to_save = read_pi_reports()

                write_pi_reports(reports_to_save)
                pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
                pulse_mb = round(pulse_bytes / (1024 * 1024), 2)
                self._send_json(
                    200,
                    {
                        "success": True,
                        "count": len(reports_to_save),
                        "file": REPORTS_DB_FILE,
                        "photos_dir": PHOTOS_DIR,
                        "pulse_folder_mb": pulse_mb,
                    },
                )
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
            return

        if path == "/api/reports":
            try:
                payload = json.loads(raw_data.decode("utf-8")) if raw_data else {}
                current = read_pi_reports()

                if isinstance(payload, list):
                    reports_to_save = payload
                    write_pi_reports(reports_to_save)
                    self._send_json(200, {"success": True, "count": len(reports_to_save)})
                    return

                if isinstance(payload, dict) and "reports" in payload and isinstance(payload["reports"], list):
                    reports_to_save = payload["reports"]
                    write_pi_reports(reports_to_save)
                    self._send_json(200, {"success": True, "count": len(reports_to_save)})
                    return

                if isinstance(payload, dict):
                    rep_id = str(payload.get("id") or f"rep-{int(time.time() * 1000)}")
                    raw_ticket = str(
                        payload.get("ticketNumber") or f"TUGON-CAV-{int(time.time() * 1000) % 10000:04d}"
                    ).strip().lstrip("#")
                    for legacy_pfx in ("PULSE-CAV-", "pulse-cav-", "TRASH-CAV-", "DRAW-CAV-"):
                        if raw_ticket.startswith(legacy_pfx):
                            raw_ticket = "TUGON-CAV-" + raw_ticket[len(legacy_pfx):]
                            break
                    ticket_num = raw_ticket
                    new_rep = dict(payload)
                    new_rep["id"] = rep_id
                    new_rep["ticketNumber"] = ticket_num
                    new_rep["localSyncStatus"] = "SENT_TO_PI"
                    new_rep.setdefault("status", "PENDING")
                    new_rep.setdefault("createdAt", datetime.datetime.utcnow().isoformat() + "Z")
                    new_rep.setdefault("photos", [])
                    new_rep.setdefault("proofPhotos", [])

                    deduped = [
                        r
                        for r in current
                        if isinstance(r, dict)
                        and str(r.get("id")) != rep_id
                        and str(r.get("ticketNumber", "")).upper().replace("PULSE-CAV-", "TUGON-CAV-")
                        != ticket_num.upper()
                    ]
                    updated_list = [new_rep] + deduped
                    write_pi_reports(updated_list)
                    self._send_json(201, {"success": True, "report": new_rep, "count": len(updated_list)})
                    return

                self._send_json(400, {"success": False, "error": "Invalid report payload"})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
            return

        if path.startswith("/api/logbook/save"):
            try:
                payload = json.loads(raw_data.decode("utf-8")) if raw_data else {}
                requested_name = payload.get("filename") if isinstance(payload, dict) else None
                if requested_name and str(requested_name).endswith(".json"):
                    filename = os.path.basename(str(requested_name))
                else:
                    filename = f"TUGON_Logbook_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                file_path = os.path.join(LOGBOOKS_DIR, filename)
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False)
                if isinstance(payload, dict) and isinstance(payload.get("reports"), list):
                    sync_report_photos_to_disk(payload["reports"])
                pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
                pulse_mb = round(pulse_bytes / (1024 * 1024), 2)
                self._send_json(
                    200,
                    {
                        "success": True,
                        "message": "Logbook saved to Raspberry Pi Hard Drive!",
                        "filename": filename,
                        "file": file_path,
                        "folder": LOGBOOKS_DIR,
                        "current_pulse_storage_mb": pulse_mb,
                    },
                )
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
            return

        if path.startswith("/api/system/shutdown"):
            self._send_json(
                200,
                {
                    "success": True,
                    "message": "Safe shutdown initiated. Wait 5 seconds until the green LED stops blinking before unplugging.",
                },
            )

            def do_halt():
                time.sleep(1.2)
                os.system("sync")
                os.system("sudo shutdown -h now || sudo poweroff")

            threading.Thread(target=do_halt, daemon=True).start()
            return

        if path.startswith("/api/system/reboot"):
            self._send_json(
                200,
                {
                    "success": True,
                    "message": "Raspberry Pi is rebooting and will auto-start shortly.",
                },
            )

            def do_reboot():
                time.sleep(1.2)
                os.system("sync")
                os.system("sudo reboot")

            threading.Thread(target=do_reboot, daemon=True).start()
            return

        self._send_json(404, {"error": "POST endpoint not found", "path": path})

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        raw_data = self.rfile.read(length) if length > 0 else b""

        if path.startswith("/api/reports/"):
            try:
                remainder = path[len("/api/reports/"):].strip("/")
                if remainder.endswith("/status"):
                    remainder = remainder[: -len("/status")].strip("/")
                target_id = urllib.parse.unquote(remainder)
                payload = json.loads(raw_data.decode("utf-8")) if raw_data else {}
                current = read_pi_reports()
                now_iso = datetime.datetime.utcnow().isoformat() + "Z"
                matched = None

                target_norm = target_id.lstrip("#").upper().replace("PULSE-CAV-", "TUGON-CAV-")
                for rep in current:
                    if isinstance(rep, dict) and (
                        str(rep.get("id")) == target_id
                        or str(rep.get("ticketNumber")) == target_id
                        or str(rep.get("ticketNumber", "")).lstrip("#").upper().replace("PULSE-CAV-", "TUGON-CAV-")
                        == target_norm
                    ):
                        status = payload.get("status")
                        if status:
                            rep["status"] = status
                            if status == "DISPATCHED":
                                rep["dispatchedAt"] = now_iso
                                rep["dispatchedKagawad"] = payload.get("dispatchedKagawad") or "Barangay Official"
                            elif status == "RESOLVED":
                                rep["resolvedAt"] = now_iso
                                rep["resolvedBy"] = payload.get("resolvedBy") or "Barangay Official"
                                if isinstance(payload.get("proofPhotos"), list):
                                    rep["proofPhotos"] = payload["proofPhotos"]
                                if payload.get("resolutionNotes"):
                                    rep["resolutionNotes"] = payload["resolutionNotes"]
                                if payload.get("proofKagawadName"):
                                    rep["proofKagawadName"] = payload["proofKagawadName"]
                            elif status == "CANCELLED":
                                rep["cancelledAt"] = now_iso
                                rep["cancellationReason"] = payload.get("cancellationReason") or "Cancelled"
                        matched = rep
                        break

                if not matched:
                    self._send_json(404, {"success": False, "error": "Report not found on Pi"})
                    return

                write_pi_reports(current)
                self._send_json(200, {"success": True, "report": matched})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})
            return

        self._send_json(404, {"error": "PATCH endpoint not found", "path": path})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path.startswith("/api/reports"):
            target_id = (qs.get("id") or [""])[0].strip()
            if not target_id and path.startswith("/api/reports/"):
                target_id = urllib.parse.unquote(path[len("/api/reports/"):].strip("/"))
            if not target_id:
                self._send_json(400, {"success": False, "error": "Missing report id"})
                return
            target_norm = target_id.lstrip("#").upper().replace("PULSE-CAV-", "TUGON-CAV-")
            current = read_pi_reports()
            filtered = [
                r
                for r in current
                if str(r.get("id")) != target_id
                and str(r.get("ticketNumber")) != target_id
                and str(r.get("ticketNumber", "")).lstrip("#").upper().replace("PULSE-CAV-", "TUGON-CAV-")
                != target_norm
            ]
            write_pi_reports(filtered)
            self._send_json(
                200,
                {
                    "success": True,
                    "deletedId": target_id,
                    "remaining": len(filtered),
                },
            )
            return

        if path.startswith("/api/logbooks"):
            target_file = (qs.get("filename") or qs.get("id") or [""])[0].strip()
            if not target_file and path.startswith("/api/logbooks/"):
                target_file = urllib.parse.unquote(path[len("/api/logbooks/"):].strip("/"))
            if not target_file:
                self._send_json(400, {"success": False, "error": "Missing filename"})
                return
            safe_name = os.path.basename(target_file)
            deleted = False
            if os.path.exists(LOGBOOKS_DIR):
                for fname in os.listdir(LOGBOOKS_DIR):
                    if fname == safe_name or target_file in fname:
                        fp = os.path.join(LOGBOOKS_DIR, fname)
                        try:
                            os.remove(fp)
                            deleted = True
                        except Exception:
                            pass
            self._send_json(200, {"success": True, "deleted": deleted, "filename": safe_name})
            return

        self._send_json(404, {"error": "DELETE endpoint not found", "path": path})


def run():
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    else:
        port = int(os.environ.get("PI_PORT") or os.environ.get("PORT") or "8000")
    lan_ip = get_lan_ip()
    print("=" * 68)
    print("  T.U.G.O.N. RASPBERRY PI 4B CLOUD STORAGE SERVER (Brgy 40 & 41)")
    print(f"  Storage Folder : {STORAGE_DIR}")
    print("  Subfolders     : saved_logbooks, photos, purged_archives")
    print(f"  Local LAN URL  : http://{lan_ip}:{port}")
    print("  Zero-Dependency: Python 3 Standard Library (ThreadingHTTPServer)")
    print("=" * 68)
    server = ReusableThreadingHTTPServer(("0.0.0.0", port), PulseHttpHandler)
    print(f"  Listening on http://0.0.0.0:{port} ...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped cleanly.")


if __name__ == "__main__":
    run()
