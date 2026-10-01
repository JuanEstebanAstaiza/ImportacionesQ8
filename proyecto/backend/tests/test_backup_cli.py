"""Backup desde la línea de comandos (`scripts/backup.py`) y verificación al restaurar.

1. Genera el ZIP con su `.sha256` y pasa la verificación.
2. La verificación detecta un ZIP alterado, truncado o incoherente con su manifiesto.
3. La retención conserva solo los N más recientes.
4. Una tabla que no se puede volcar hace fallar el backup en vez de omitirse.
5. Tras restaurar, los conteos se comparan con el manifiesto.
"""
import json
import zipfile
from pathlib import Path

import pytest

from scripts.backup import aplicar_retencion, escribir_suma, generar, main, verificar_backup


@pytest.fixture()
def carpeta(tmp_path):
    return tmp_path / "backups"


class TestGenerar:
    def test_genera_zip_verificable_con_suma(self, db_session, carpeta):
        assert main(["--destino", str(carpeta), "--retener", "0", "--sin-archivos"]) == 0
        zips = list(carpeta.glob("importacionesq8-backup-*.zip"))
        assert len(zips) == 1
        assert (carpeta / (zips[0].name + ".sha256")).is_file()
        assert not list(carpeta.glob("*.parcial"))
        manifiesto = verificar_backup(zips[0])
        assert "usuarios" in manifiesto["tablas"]

    def test_falla_si_una_tabla_no_se_pudo_volcar(self, db_session, carpeta, monkeypatch):
        import services.backup_service as servicio

        original = servicio._filas_de_tabla

        def falla_en_usuarios(db, tabla):
            if tabla.name == "usuarios":
                raise RuntimeError("disco lleno")
            return original(db, tabla)

        monkeypatch.setattr(servicio, "_filas_de_tabla", falla_en_usuarios)
        assert main(["--destino", str(carpeta), "--retener", "0", "--sin-archivos"]) == 1
        assert not list(carpeta.glob("*.zip"))
        assert not list(carpeta.glob("*.parcial"))


class TestVerificar:
    def _backup(self, db_session, carpeta) -> Path:
        ruta, _ = generar(carpeta, incluir_archivos=False)
        return ruta

    def test_detecta_zip_alterado(self, db_session, carpeta):
        ruta = self._backup(db_session, carpeta)
        with ruta.open("ab") as f:
            f.write(b"basura")
        with pytest.raises(ValueError, match="SHA-256"):
            verificar_backup(ruta)
        assert main(["--verificar", str(ruta)]) == 1

    def test_detecta_zip_truncado_sin_suma(self, db_session, carpeta):
        ruta = self._backup(db_session, carpeta)
        ruta.with_name(ruta.name + ".sha256").unlink()
        datos = ruta.read_bytes()
        ruta.write_bytes(datos[: len(datos) // 2])
        with pytest.raises(ValueError):
            verificar_backup(ruta)

    def test_detecta_manifiesto_incoherente(self, db_session, carpeta, tmp_path):
        ruta = self._backup(db_session, carpeta)
        manipulado = tmp_path / "manipulado.zip"
        with zipfile.ZipFile(ruta) as origen, zipfile.ZipFile(manipulado, "w") as destino:
            for nombre in origen.namelist():
                contenido = origen.read(nombre)
                if nombre == "manifest.json":
                    manifiesto = json.loads(contenido)
                    manifiesto["tablas"]["usuarios"] += 1
                    contenido = json.dumps(manifiesto).encode()
                destino.writestr(nombre, contenido)
        with pytest.raises(ValueError, match="usuarios"):
            verificar_backup(manipulado)

    def test_un_backup_sano_pasa(self, db_session, carpeta):
        ruta = self._backup(db_session, carpeta)
        assert main(["--verificar", str(ruta)]) == 0


class TestRetencion:
    def test_conserva_los_mas_recientes(self, tmp_path):
        for marca in ("20260101-000000", "20260102-000000", "20260103-000000", "20260104-000000"):
            zip_ = tmp_path / f"importacionesq8-backup-{marca}.zip"
            zip_.write_bytes(b"x")
            escribir_suma(zip_)
        otro = tmp_path / "no-es-un-backup.zip"
        otro.write_bytes(b"x")

        borrados = aplicar_retencion(tmp_path, 2)

        assert [p.name for p in borrados] == [
            "importacionesq8-backup-20260101-000000.zip",
            "importacionesq8-backup-20260102-000000.zip",
        ]
        quedan = sorted(p.name for p in tmp_path.iterdir())
        assert quedan == [
            "importacionesq8-backup-20260103-000000.zip",
            "importacionesq8-backup-20260103-000000.zip.sha256",
            "importacionesq8-backup-20260104-000000.zip",
            "importacionesq8-backup-20260104-000000.zip.sha256",
            "no-es-un-backup.zip",
        ]

    def test_cero_no_borra_nada(self, tmp_path):
        (tmp_path / "importacionesq8-backup-20260101-000000.zip").write_bytes(b"x")
        assert aplicar_retencion(tmp_path, 0) == []


class TestConteosTrasRestaurar:
    def test_compara_con_el_manifiesto(self, db_session, carpeta):
        from scripts.restaurar_backup import verificar_conteos

        _, manifiesto = generar(carpeta, incluir_archivos=False)
        assert verificar_conteos(manifiesto) == []

        manifiesto["tablas"]["usuarios"] += 5
        discrepancias = verificar_conteos(manifiesto)
        assert [d[0] for d in discrepancias] == ["usuarios"]
        assert discrepancias[0][1] == discrepancias[0][2] + 5


class TestCicloCompleto:
    """Backup de una base y restauración en otra vacía, como tras `docker compose down -v`.

    Corre en procesos aparte con sus propias bases SQLite: la restauración vacía
    tablas, y no debe tocar la base compartida del resto de la suite.
    """

    def _ejecutar(self, args, db_url, cwd):
        import os
        import subprocess
        import sys

        entorno = {
            **os.environ,
            "DATABASE_URL": db_url,
            "APP_ENV": "test",
            "SECRET_KEY": "test-secret-key-not-for-production-use-only!!",
        }
        return subprocess.run(
            [sys.executable, *args], cwd=cwd, env=entorno, capture_output=True, text=True, timeout=180,
        )

    def test_respaldar_y_restaurar_en_base_vacia(self, tmp_path):
        backend = Path(__file__).resolve().parent.parent
        origen = f"sqlite:///{tmp_path / 'origen.db'}"
        destino = f"sqlite:///{tmp_path / 'destino.db'}"
        sembrar = (
            "import models; from database import create_tables, SessionLocal;"
            "from models.usuario import Usuario; from models.importador import Importador;"
            "create_tables(); db = SessionLocal();"
            "db.add(Importador(id='11111111-1111-1111-1111-111111111111', nombre_empresa='Ñandú S.A.S.',"
            " tiempo_respuesta_promedio='24h', especialidad_producto=['Textiles'], paises_origen=['China'],"
            " limite_cotizaciones_diarias=5));"
            "db.add(Usuario(id='22222222-2222-2222-2222-222222222222', email='a@b.co', password_hash='x', rol='importador',"
            " importador_id='11111111-1111-1111-1111-111111111111', nombre='Dueño'));"
            "db.commit()"
        )
        r = self._ejecutar(["-c", sembrar], origen, backend)
        assert r.returncode == 0, r.stderr

        carpeta = tmp_path / "backups"
        r = self._ejecutar(["scripts/backup.py", "--destino", str(carpeta), "--sin-archivos"], origen, backend)
        assert r.returncode == 0, r.stderr
        zip_ = next(carpeta.glob("importacionesq8-backup-*.zip"))

        r = self._ejecutar(
            ["scripts/restaurar_backup.py", str(zip_), "--crear-esquema", "--aplicar", "--sin-archivos"],
            destino, backend,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert "todas las tablas tienen las mismas filas" in r.stdout

        comprobar = (
            "from database import SessionLocal; from models.importador import Importador;"
            "i = SessionLocal().query(Importador).one(); print(i.nombre_empresa, i.limite_cotizaciones_diarias, i.especialidad_producto)"
        )
        r = self._ejecutar(["-c", comprobar], destino, backend)
        assert r.returncode == 0, r.stderr
        assert r.stdout.strip() == "Ñandú S.A.S. 5 ['Textiles']"

    def test_no_restaura_un_zip_danado(self, tmp_path):
        backend = Path(__file__).resolve().parent.parent
        zip_ = tmp_path / "importacionesq8-backup-20260101-000000.zip"
        zip_.write_bytes(b"no es un zip")
        r = self._ejecutar(["scripts/restaurar_backup.py", str(zip_), "--aplicar"], f"sqlite:///{tmp_path / 'x.db'}", backend)
        assert r.returncode != 0
        assert "no es fiable" in (r.stdout + r.stderr)
