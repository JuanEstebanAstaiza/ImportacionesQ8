# 12 - Chat y ayuda UX

Guia de comportamiento de chat y soporte para mantener una experiencia consistente entre roles.

## Chat: mejoras aplicadas

- Boton de chat en header redirige a la vista de chat del rol.
- Badge usa conteo dinamico de no leidos.
- Composer alineado verticalmente en controles principales.
- Emoji picker funcional para insercion rapida.
- Botones de adjuntos/imagen abren selector de archivos.

---

## Flujo de composer

```text
Usuario escribe mensaje
  -> Opcional: emoji
  -> Opcional: adjuntar archivo o imagen
  -> Enviar
```

---

## Ayuda y soporte

- Pantalla dedicada para roles no-admin.
- Admin no visualiza boton de ayuda.
- FAQ ampliado por rol.
- Busqueda por texto en FAQ.
- Chips de temas rapidos para autocompletar filtros.

---

## Reglas por rol

| Rol | Ayuda visible | Perfil de contenido |
|-----|----------------|---------------------|
| solicitante | Si | compra y comparacion de propuestas |
| importadora | Si | operacion comercial y gestion de asesores |
| asesor | Si | pipeline, propuestas y cierre |
| admin | No | n/a |

---

## Alertas de mantenimiento

1. Si cambia el contrato de notificaciones, validar badge de chat.
2. Si cambia el layout header, validar accesibilidad de iconos.
3. Si se reemplaza composer, preservar apertura de picker de archivos.

---

## Referencias

- [[Contrato-Shell-Header-Sidebar]]
- [[Routing-y-Roles-Frontend]]

← Volver a [[Indice-Frontend]]
