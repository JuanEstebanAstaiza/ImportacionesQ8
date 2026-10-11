/**
 * ¿Está abierto el registro público? Lo decide el admin en *Módulos* y llega en
 * `/configuracion-publica`. App lo fija en cada render con la configuración
 * cargada; los botones de «Crear cuenta» (landing, login, Tendencias…) lo leen
 * para no ofrecer un registro que el backend va a rechazar. Como App vuelve a
 * renderizar todo el árbol al cambiar la configuración, el valor siempre está al día.
 */
let abierto = true;
let correo = "contacto@zarpi.co";

export function fijarRegistro(estaAbierto: boolean, correoContacto?: string): void {
  abierto = estaAbierto;
  if (correoContacto) correo = correoContacto;
}

export function registroAbierto(): boolean {
  return abierto;
}

export function correoContacto(): string {
  return correo;
}
