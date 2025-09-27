# Polla El Fenix — Documentación de Autocompletado y Navegación

Este repositorio contiene la aplicación "Polla El Fenix". Este README resume las mejoras realizadas relacionadas con el autocompletado de nombres y la navegación entre celdas.

Desarrollado por: Sneider22 y rmaneiro28

## Resumen de cambios implementados
- Autocompletado en el modal "AGREGAR NUEVA JUGADA" usando los nombres registrados en la base de jugadores (`JugadoresDB`).
- Autocompletado integrado en la columna "Nombre" de las tablas (POLLA / MICRO): al hacer doble clic en la celda, aparece un input con sugerencias.
- Prioridad por prefijo: las sugerencias muestran primero los nombres que comienzan por la cadena escrita y luego las que la contienen.
- Límite de sugerencias: máximo 7 ítems.
- Mensaje "Sin resultados" cuando no se encuentran coincidencias.
- Al escribir un nombre nuevo directamente en la tabla y salir de la celda, el nombre se guarda automáticamente en la base de datos de jugadores (`JugadoresDB`) si está disponible, y siempre se añade a la lista en memoria para el autocompletado durante la sesión.
- Navegación con teclado dentro de la tabla:
  - Tab / Shift+Tab — ya existentes: pasar a la siguiente/anterior celda editable.
  - Flecha derecha (➡️) — si el caret está al final del input, pasa a la celda editable de la derecha.
  - Flecha izquierda (⬅️) — si el caret está al inicio, pasa a la celda editable de la izquierda.
  - Flecha arriba (⬆️) / Flecha abajo (⬇️) — mueven a la celda editable de la misma columna en la fila superior / inferior.
- UX móvil: transiciones en los items de sugerencia (translate-x) para una sensación de deslizamiento.

## Archivos modificados
- `main.js` — principal lugar de los cambios:
  - Carga y cache en memoria de jugadores: `loadAllPlayersForAutocomplete` y `allPlayersSupabase`.
  - Autocomplete: `handleAutocompleteInput`, `showAutocomplete`, `selectAutocompleteItem`, `hideAutocomplete`.
  - Integración en tabla: `makeCellEditable` ahora crea un wrapper con sugerencias y auto-guardado.
  - Navegación con flechas: handlers para ArrowLeft, ArrowRight, ArrowUp y ArrowDown.
- `index.html` — ya incluía el contenedor del modal; no se requieren cambios de estructura mayores (se reutiliza `#autocompleteList` en el modal).

## Cómo usar (usuario)
1. Abrir `index.html` en un navegador (asegúrate de tener configurada la parte de Supabase si usas almacenamiento remoto).
2. Gestionar jugadores: Opcionalmente usa "GESTIONAR JUGADORES" para añadir jugadores manualmente.
3. Agregar jugada (modal): al escribir en "NOMBRE DEL JUGADOR" verás sugerencias (máx. 7). Selecciona con mouse o teclado.
4. Editar directamente en la tabla: haz doble clic en la celda Nombre, escribe; si es un nombre nuevo, al salir se guardará automáticamente y estará disponible para autocompletar en otras filas.
5. Navegación ágil: usa Tab/Shift+Tab o las flechas → ← ↑ ↓ según lo explicado.

## Notas técnicas
- El autocompletado busca en `allPlayersSupabase`, que se carga desde `JugadoresDB.obtenerTodos()` si `JugadoresDB` está disponible. Si no hay conexión con Supabase la lista se mantendrá en memoria (los nombres nuevos se añadirán en la sesión).
- El guardado automático usa `JugadoresDB.crear(name)` si `JugadoresDB` ofrece ese método.
- El filtrado prioriza `startsWith` y luego `includes` para una mejor experiencia de búsqueda.

## Posibles mejoras
- Añadir debounce al input de autocompletado si hay cientos/miles de jugadores.
- Persistir en `localStorage` cuando `JugadoresDB` no esté disponible para mantener nombres entre sesiones locales.
- Ajustes visuales para accesibilidad (contrastes, tamaño táctil).

## Créditos
Desarrollado por Sneider22 y rmaneiro28

---
Si quieres que añada un apartado con comandos de ejecución o ejemplos de tests automáticos, dímelo y lo agrego.