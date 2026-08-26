# 11 - Cursos: experiencia y player

Documenta el flujo de cursos para evitar regresiones en aprendizaje, progreso y reproduccion.

## Problemas que se corrigieron

- Boton "Ir a la clase" sin accion clara.
- Reproductor y guia siempre visibles en la pagina, afectando foco.
- Auto-avance inconsistente al terminar videos de YouTube.
- Toggle/tabs sin estado visual activo suficientemente claro.

---

## Solucion UX aplicada

1. "Ir a la clase" abre player en modal dedicado.
2. Se removio el panel siempre visible del cuerpo principal.
3. Se reforzo la deteccion de fin de video con eventos `postMessage` para embeds compatibles.
4. Se mejoraron estilos de tabs activos para feedback inmediato.

---

## Flujo recomendado de aprendizaje

```text
Mis cursos -> Ir a la clase -> Modal player
  -> Ver leccion actual
  -> Marcar/completar por fin de reproduccion
  -> Auto-avanzar a siguiente leccion
```

---

## Consideraciones tecnicas

- YouTube embed requiere parametros para eventos (ejemplo: `enablejsapi=1`).
- Filtro por `contentWindow` evita reaccionar a mensajes de iframes no relacionados.
- Para videos no-YouTube se mantiene fallback de reproduccion segura.

---

## Checklist de QA

1. Abrir curso y entrar por "Ir a la clase".
2. Confirmar apertura de modal en desktop y mobile.
3. Finalizar leccion de YouTube y verificar avance automatico.
4. Confirmar estado activo visible en tabs.
5. Cerrar/reabrir modal sin perder estado critico.

---

## Referencias

- [[Pantallas-Importador]]
- [[Pantallas-Solicitante]]

← Volver a [[Indice-Frontend]]
