# Minute Cutter — Panel CEP para Premiere Pro

Panel CEP para Premiere Pro que recorta rangos de un clip de video **directamente desde el material fuente** (tiempos de fuente, no de timeline) en una sola operación, con corte de audio vinculado, cierre del hueco (ripple) y escala automática de los pedazos resultantes.

## Qué hace

- Se elige un clip en el timeline (o en el Proyecto si ya existe una instancia en el timeline).
- Se cargan una o más filas con rangos `Inicio` / `Fin`.
- Al presionar **Cortar**, la extensión:
  1. Crea un *subclip* por cada rango conservado (basado en el material fuente del clip).
  2. Elimina el clip original (video y audio vinculado).
  3. Inserta los subclips en la posición original.
  4. Aplica **escala automática 140 %** a cada pedazo.
  5. Corre los clips posteriores para cerrar el hueco (ripple).

## Hosts soportados

| Componente | Versión |
|---|---|
| Premiere Pro | 22.x (verificado en 22.5.0) — manifest `[22.0, 22.9]` |
| Runtime | CEP 12 (CSXS 11) |
| Sistema | Windows |

## Instalación (Windows)

1. Cerrá Premiere Pro por completo.
2. Copiá el contenido de la carpeta `extension` a la carpeta de extensiones de usuario:

   ```powershell
   Copy-Item -Recurse -Force .\extension\* "$env:APPDATA\Adobe\CEP\extensions\com.pelot.minutecutter\"
   ```

   La estructura instalada debe quedar:

   ```
   %APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter\
   ├── CSXS\manifest.xml
   ├── client\index.html, index.css, index.js
   └── host\main.jsx
   ```

3. Habilitá extensiones CEP sin firmar creando la clave de registro `PlayerDebugMode`:

   ```
   HKEY_CURRENT_USER\Software\Adobe\CSXS.11
   Valor: PlayerDebugMode  (REG_SZ)  =  1
   ```

   Desde PowerShell (una sola vez):

   ```powershell
   New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force | Out-Null
   Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1"
   ```

4. Reabrí Premiere Pro. El panel aparece en **Window > Extensions > Minute Cutter**.

> El path del host (`host/main.jsx`) se deriva en runtime desde la URL del panel; no quedan rutas de usuario hardcodeadas.

## Flujo de uso

1. Abrí el panel **Minute Cutter** (Window > Extensions).
2. Seleccioná un **clip de video** en el timeline (o en el Proyecto si ya tiene una instancia en el timeline).
3. Cargá una o más filas con los rangos a conservar. Cada fila tiene `Inicio` y `Fin`.
4. Presioná **Cortar**.
5. El estado de la operación se muestra en la barra inferior del panel.

## Formato de tiempos

- Formato `mm:ss` (ej. `1:20`, `2:05`). También acepta más segmentos (ej. `1:20:30` = 1 h 20 m 30 s).
- **Los tiempos son de fuente**, es decir relativos al material del clip (inPoint/outPoint del clip), no a la posición en el timeline.
- `Fin` debe ser mayor que `Inicio` y no puede superar la duración del material fuente del clip.

## Detalles de comportamiento

- **Audio / ripple:** el audio vinculado al video seleccionado se corta junto con este. Los clips posteriores se desplazan para cerrar el hueco.
- **Escala automática 140 %:** cada pedazo conservado se ajusta al tamaño del frame y se le aplica `Scale = 140`.

## Tomas especiales

La sección **Tomas especiales** del panel detecta los cambios de toma dentro del clip de video seleccionado y crea cortes en el timeline, **sin eliminar ningún segmento**.

### Uso

1. Seleccioná explícitamente un **TrackItem de video en el timeline** (la selección debe estar en el timeline, no en el Proyecto).
2. Elegí la **sensibilidad** de la detección: **Baja** (`LowSensitivity`), **Media** (`MediumSensitivity`, por defecto) o **Alta** (`HighSensitivity`).
3. Presioná **Detectar cambios de toma**.

La operación aplica cortes al **audio vinculado** del clip. El panel muestra el resultado en la barra inferior y vuelve a leer la selección al terminar. El botón se deshabilita durante la operación y se reactiva al terminar.

### Requisitos

- **Selección explícita de timeline**: esta operación requiere un TrackItem de video seleccionado en el timeline (`seq.getSelection()`). No usa el playhead ni la selección de Proyecto como fallback. Sin una selección de video válida se muestra un error y no se ejecuta nada.
- Sensibilidad válida: solo `LowSensitivity`, `MediumSensitivity` o `HighSensitivity`. Cualquier otro valor se interpreta como `MediumSensitivity`.
- **Guardá el proyecto** antes de ejecutar la detección: los cortes se aplican directo al timeline.

### Limitaciones y rollback

- La detección nativa es **modal** (bloquea la UI de Premiere mientras corre) y **no tiene rollback programático**: si el resultado no es el esperado, usá **Ctrl+Z** o restaurá el proyecto guardado.
- El panel no puede informar cuántos cortes se crearon: la API de Premiere devuelve `boolean`/`undefined` y no hay un conteo confiable.
- Requiere un build de Premiere que exponga `Sequence.performSceneEditDetectionOnSelection` (o su variante legacy `performCutDetectionOnSelection`). Si el build no la expone, se muestra un error y no se modifica el timeline.
- La sección **Cortar** (rangos) y la escala 140 % no cambian con esta funcionalidad: son operaciones independientes.

## Limitaciones conocidas

- Solo se admiten clips a **velocidad 1x (100 %)**. No se admiten velocidad 0, ni velocidad distinta de 1x, ni clips en **reversa**.
- Una **selección de Proyecto** (BIN) sin instancia en el timeline no se puede cortar: primero debe existir una instancia del clip en el timeline. En ese caso el panel avisa que primero hay que insertarlo.
- Si hay **audio sincronizado no seleccionado** en la posición del clip, el corte se rechaza y se pide seleccionar video + audio juntos.
- Depende de que el host exponga ciertas APIs (crear subclips, remover/insertar clips, mover). Si el build no las expone, el corte se aborta con un mensaje claro y sin tocar el timeline (o reintentando restaurar, con aviso de usar Ctrl+Z si el rollback quedó incompleto).

## Volver a una versión estable

Cada versión estable publicada lleva un tag. Para volver a la versión estable desde una copia de trabajo o tras probar cambios:

```bash
git checkout v1.0.0
```

Si se quiere re-instalar en Premiere después de un checkout, repetí el paso de copia de `extension` a `%APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter` y reiniciá Premiere.

## Estructura del repo

```
premiere-ext/
├── extension/
│   ├── CSXS/manifest.xml
│   ├── client/          # panel (index.html, index.css, index.js)
│   └── host/            # lógica ExtendScript (main.jsx)
├── .gitignore
├── README.md
└── package.json         # tooling de dev (scaffold)
```
