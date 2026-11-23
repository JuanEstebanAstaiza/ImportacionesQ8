"""Zarpi Maquilas: conecta a clientes con maquiladoras para fabricar su marca.

Como cada módulo de la suite, guarda todos sus datos en su propia base
(MongoDB, `config.MONGO_DB_MAQUILAS`) con los archivos en GridFS. Con la
plataforma solo comparte el login y los usuarios: la maquiladora es un
`Usuario` de MySQL con el rol `maquiladora`, y su empresa vive en Mongo. Lo
único que escribe en MySQL, además de esa cuenta, son los avisos de la campana.
"""
