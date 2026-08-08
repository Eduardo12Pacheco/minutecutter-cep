# Minute Cutter — Panel CEP para Premiere Pro

Panel CEP para Premiere Pro que recorta rangos de un clip de video **directamente desde el material fuente** (tiempos de fuente, no de timeline) en una sola operación, con corte de audio vinculado, cierre del hueco (ripple) y escala automática de los pedazos resultantes.

> Este README es la guía de instalación y uso. Es autocontenido: un agente o una persona con una computadora nueva puede seguir los comandos tal cual, sin información adicional.

---

## 1. Requisitos

| Requisito | Detalle |
|---|---|
| Sistema operativo | Windows (las rutas usan `%APPDATA%` y `HKCU\Software\Adobe\CSXS.11`) |
| Premiere Pro | 2022, versión **22.x** (verificado en 22.5.0) — el manifest declara `[22.0, 22.9]` |
| Runtime CEP | CEP 12 / **CSXS 11** (es la versión que usa Premiere 2022; la clave de registro se crea bajo `CSXS.11`) |
| Acceso al repositorio | Repositorio GitHub **privado**: `https://github.com/Eduardo12Pacheco/minutecutter-cep` (se requiere credencial de GitHub) |
| Premiere cerrado | Premiere Pro debe estar **completamente cerrado** durante la instalación (copia de archivos y registro). No alcanza con cerrar la ventana del proyecto: cerrá la aplicación entera. |

---

## 2. Obtener el código

### Opción A — Clonar con git

```powershell
git clone https://github.com/Eduardo12Pacheco/minutecutter-cep.git
cd minutecutter-cep
```

### Opción B — Descargar el ZIP (sin git)

1. Entrá a `https://github.com/Eduardo12Pacheco/minutecutter-cep`.
2. Botón verde **Code ▾** → **Download ZIP**.
3. Descomprimí el archivo. Queda una carpeta tipo `minutecutter-cep-main\` (el nombre depende de la rama). **Usá esa carpeta como raíz del proyecto** para los pasos siguientes.

En ambos casos vas a tener una estructura como esta en la raíz:

```
minutecutter-cep\
├── extension\          ← esto es lo que se instala en Premiere
│   ├── CSXS\manifest.xml
│   ├── client\         (index.html, index.css, index.js)
│   └── host\main.jsx
├── .gitignore
├── README.md
└── package.json
```

---

## 3. Instalar la extensión en Premiere

La instalación es **copiar el CONTENIDO de `extension\`** (no la carpeta `extension` en sí) a la carpeta de extensiones de usuario. El destino es:

```
%APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter\
```

> ⚠️ **Cuidado con la doble carpeta:** si copiás la carpeta `extension` entera (no su contenido), queda `%APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter\extension\...` y el panel no aparece. El manifest debe quedar en `%APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter\CSXS\manifest.xml`.

### Comando de instalación (PowerShell)

Ejecutalo desde la **raíz del proyecto** (donde está `extension\`). Crea el destino si no existe y copia el contenido:

```powershell
$src = Join-Path (Get-Location) "extension"
$dest = "$env:APPDATA\Adobe\CEP\extensions\com.pelot.minutecutter"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path (Join-Path $src "*") -Destination $dest -Recurse -Force
```

### Verificación de la instalación

El comando debe devolver `True`:

```powershell
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.pelot.minutecutter\CSXS\manifest.xml"
```

La estructura instalada correcta es:

```
%APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter\
├── CSXS\manifest.xml
├── client\index.html, index.css, index.js
└── host\main.jsx
```

> Si ya había una instalación previa, la copia con `-Force` la sobrescribe. Para una reinstalación limpia podés borrar antes la carpeta de destino con `Remove-Item -Recurse -Force $dest`.

---

## 4. Habilitar extensiones CEP sin firma (PlayerDebugMode)

Las extensiones CEP **sin firma** (como esta, que se instala en modo desarrollador) requieren la clave de registro `PlayerDebugMode = 1`. Esto es **solo para desarrollo/extensiones propias**, no para extensiones firmadas. Se hace **una sola vez por computadora**.

La clave va en la versión de CSXS que usa Premiere 2022:

```
HKEY_CURRENT_USER\Software\Adobe\CSXS.11
Valor: PlayerDebugMode  (REG_SZ)  =  1
```

### Opción A — con `reg.exe` (una línea)

```powershell
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
```

### Opción B — con PowerShell

```powershell
New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1"
```

### Verificación

Debe devolver el valor `1`:

```powershell
Get-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode"
```

> No se necesita crear claves para otras versiones de CSXS (p. ej. `CSXS.12`) salvo que uses otra versión de Premiere.

---

## 5. Cerrar y reabrir Premiere

1. **Cerrá Premiere Pro por completo** (sección 1) antes de la copia y del registro.
2. Reabrí Premiere Pro.
3. Abrí el panel en **Window (Ventana) > Extensions (Extensiones) > Minute Cutter**.

El panel se muestra en la zona de paneles de Premiere y se puede acoplar donde se prefiera. Debería quedar visible automáticamente (el manifest usa `AutoVisible`).

---

## 6. Flujo de uso

1. Abrí el panel **Minute Cutter** (Window > Extensions > Minute Cutter).
2. Seleccioná una **instancia de un clip de video en el timeline**. (Una selección en el Proyecto/BIN solo sirve si ese clip ya tiene una instancia en el timeline; ver Limitaciones.)
3. Cargá una o más filas con los rangos a **conservar**. Cada fila tiene `Inicio` y `Fin`.
4. Presioná **Cortar**.
5. El estado de la operación se muestra en la barra inferior del panel, y el clip detectado arriba.

### Formato de tiempos

- Formato `mm:ss` (ej. `1:20`, `2:05`). También acepta más segmentos (ej. `1:20:30` = 1 h 20 m 30 s).
- **Los tiempos son de FUENTE**: relativos al material del clip (su `inPoint`/`outPoint`), NO a la posición en el timeline.
- `Fin` debe ser mayor que `Inicio` y no puede superar la duración del material fuente del clip.

### Qué hace el corte

1. Crea un **subclip** por cada rango conservado, basado en el material fuente del clip.
2. Elimina el clip original (video y audio vinculado).
3. Inserta los subclips en la posición original.
4. Aplica **escala automática 140 %** a cada pedazo (ajusta a tamaño de frame + `Scale = 140`).
5. Corre los clips posteriores para cerrar el hueco (**ripple**).

### Prueba recomendada

Probá por primera vez un rango corto tipo **`0:10` → `0:20`**. Hacelo sobre un proyecto de prueba o una **copia del proyecto**: no lo pruebes sobre el único proyecto original ni sobre un proyecto duplicado (dos proyectos/timelines con el mismo material pueden resolverse mal). Mantené un backup del proyecto antes de usar el corte.

---

## 7. Limitaciones conocidas

- Solo se admiten clips a **velocidad 1x (100 %)**. No se admiten velocidad 0, ni velocidad distinta de 1x, ni clips en **reversa**.
- Una **selección de Proyecto (BIN) sin instancia en el timeline no se puede cortar**: primero debe existir una instancia del clip en el timeline. En ese caso el panel avisa que primero hay que insertarlo.
- Si hay **audio sincronizado no seleccionado** en la posición del clip, el corte se rechaza y se pide seleccionar video + audio juntos.
- Depende de que el host exponga ciertas APIs (crear subclips, remover/insertar clips, mover). Si el build no las expone, el corte se aborta con un mensaje claro y sin tocar el timeline (o reintentando restaurar, con aviso de usar Ctrl+Z si el rollback quedó incompleto).
- **Hacé backup del proyecto** antes de cortar; la herramienta modifica el timeline.

---

## 8. Diagnóstico operativo

El panel no tiene botón de diagnóstico: muestra su estado en la barra inferior y en la línea de clip. Los mensajes son los que emite el host (`extension/host/main.jsx`) o el panel (`extension/client/index.js`).

### Si el panel no aparece en Window > Extensions

Verificá en orden:

1. Que Premiere esté **completamente cerrado** y se haya reabierto **después** de la copia y el registro.
2. Que la instalación sea correcta: `Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.pelot.minutecutter\CSXS\manifest.xml"` debe dar `True`. Si no, hay doble carpeta `extension\extension` (sección 3).
3. Que `PlayerDebugMode = 1` esté bajo **`CSXS.11`** (sección 4). Otra versión de CSXS no habilita el panel en Premiere 2022.
4. Que la versión de Premiere sea 22.x (el manifest declara `[22.0, 22.9]`).

### Si el panel abre pero muestra un error de host

El panel intenta cargar `host/main.jsx` automáticamente al arrancar. Mensajes posibles:

- **`Error cargando host: ...`** → el host no se cargó. Verificá que exista `%APPDATA%\Adobe\CEP\extensions\com.pelot.minutecutter\host\main.jsx` (copia incompleta). Si falta, repetí el paso de copia (sección 3) y reiniciá Premiere.
- **`Error del host: ...`** → el host respondió con un error. Revisá que la copia sea de la versión esperada y reiniciá Premiere.
- **`Extensión sin host CEP`** → el panel no detecta el runtime CEP (problablemente Premiere no lo cargó como panel CEP; verificá los pasos de la sección 5).

### Mensajes esperados según la selección

| Situación | Mensaje en el panel |
|---|---|
| Clip de timeline detectado y listo | `Clip: <nombre> — Duración: <mm:ss>` y botón **Cortar** habilitado |
| Sin clip seleccionado | `Sin clip seleccionado. Elegí un clip en el timeline o en el proyecto.` |
| Selección de Proyecto (BIN) sin instancia en timeline | `Clip de Proyecto detectado; para cortar, primero debe existir en timeline` |
| Corte exitoso | `Corte realizado en N pedazo(s)` (puede incluir avisos de escala o alineación) |
| Corte con timeout | `Error: timeout del host. El corte pudo no completarse; revisá el timeline.` |

Otros errores de corte posibles (según validaciones del host): velocidad distinta de 1x, clip en reversa, rango que supera la duración de la fuente, audio sincronizado no seleccionado, selección de Proyecto sin instancia, o APIs no expuestas por el build. Todos se muestran en la barra inferior con prefijo `Error: ...`.

---

## 9. Volver a una versión estable (rollback)

Cada versión estable publicada lleva un **tag** en git. Para volver a la última versión estable desde una copia de trabajo o tras probar cambios:

```bash
git checkout v1.0.0
```

### Tags y commits de referencia

- Tag estable actual: **`v1.0.0`**.
- Commit que publicó la versión estable: `bc152` (`feat(minutecutter): publish stable CEP cutter`).
- Ver tags disponibles: `git tag -l` · Ver commits: `git log --oneline`.

### Reinstalar la versión del checkout

Después de un `git checkout`, la carpeta `extension\` queda con el código de esa versión. Reinstalá en Premiere repitiendo el paso de copia (sección 3) y reiniciá Premiere:

```powershell
$src = Join-Path (Get-Location) "extension"
$dest = "$env:APPDATA\Adobe\CEP\extensions\com.pelot.minutecutter"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path (Join-Path $src "*") -Destination $dest -Recurse -Force
```

Para volver al último código de la rama principal: `git checkout main` (y reinstalar de nuevo).

---

## 10. Seguridad

- **No committear secretos**: no subir claves API, tokens ni credenciales al repositorio. El `.gitignore` ya excluye `.env`, archivos de backup y temporales. Revisá `git status` y `git diff` antes de cualquier commit.
- **Repositorio privado**: `Eduardo12Pacheco/minutecutter-cep` es privado. No lo hagas público; contiene código propio de distribución.
- **PlayerDebugMode** es una clave global de desarrollo que permite cargar extensiones CEP sin firmar. Es solo para desarrollo: no habilites ni distribuyas extensiones sin firmar en producción, y considerá quitarla (`reg delete "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /f`) cuando no la necesites.
- El panel no transmite datos: toda la lógica corre localmente dentro de Premiere.

---

## Estructura del repo

```
minutecutter-cep/
├── extension/
│   ├── CSXS/manifest.xml   # declara el panel: PPRO 22.x, CSXS 11, UI "Minute Cutter"
│   ├── client/             # panel (index.html, index.css, index.js)
│   └── host/               # lógica ExtendScript (main.jsx)
├── .gitignore
├── README.md
└── package.json            # tooling de dev (scaffold)
```
