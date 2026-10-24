"""Zarpi Liquidaciones: marketplace B2B de lotes completos a precio fijo.

Es un módulo de la suite con su propia base (MongoDB, ver `db.py`). De la
plataforma solo toma el login y los usuarios: el JWT dice quién es y con qué
rol, y todo lo demás —lotes, operaciones, chat, activaciones, archivos— vive
aquí. Lo único que escribe en MySQL son los avisos de la campana, que es común
a toda la suite.
"""
