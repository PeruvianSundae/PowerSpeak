# PowerSpeak
PWA offline para aprender portugués, japonés, chino, ruso e inglés.

**App:** https://peruviansundae.github.io/PowerSpeak/

Tarjetas con repetición espaciada (SM-2, estilo Anki), audio con la voz del
navegador y ~100 palabras de nivel A1 por idioma. Todo funciona sin conexión y
el progreso se guarda solo en tu navegador: no hay cuentas ni servidor.

## Qué incluye

- **Inicio**: los 5 idiomas con «X pendientes · Y nuevas» y tu racha de días.
- **Sesión de estudio**: la palabra (con furigana en japonés, pinyin con tonos
  en chino y acento tónico en ruso), botón 🔊 y cuatro botones para calificar
  —**Otra vez / Difícil / Bien / Fácil**— que muestran cuándo volverá la
  tarjeta.
- **Fin de sesión**: tarjetas repasadas, nuevas, % de aciertos, racha y tiempo.
- **Estadísticas**: aprendidas / en aprendizaje / sin ver por idioma, repasos
  de los últimos 7 días y tiempo de estudio.
- **Ajustes**: nuevas por día (10 por defecto) y máximo de repasos (200) por
  idioma, modo inverso (español → idioma), audio automático y velocidad,
  furigana / pinyin / romanización, tema claro u oscuro, y **exportar /
  importar / reiniciar** el progreso.

## Cómo se usa

1. Elige un idioma en el inicio.
2. Intenta recordar el significado y toca **Mostrar respuesta** (o la tarjeta).
3. Califica con sinceridad:
   - **Otra vez**: no la recordabas → vuelve en 1 minuto.
   - **Difícil**: la recordaste con esfuerzo.
   - **Bien**: la recordaste.
   - **Fácil**: la sabías de sobra.
4. Vuelve cada día: las tarjetas reaparecen justo antes de que las olvides. El
   «día» empieza a las 4:00 a.m., así que estudiar de madrugada cuenta para el
   día anterior.

En computadora: **espacio** = mostrar respuesta, **1–4** = calificar,
**R** = repetir el audio.

> **Respaldo:** el progreso vive solo en este navegador. De vez en cuando ve a
> Ajustes → **Exportar progreso** y guarda el archivo `.json`. Para pasarlo a
> otro celular o navegador usa **Importar progreso**.

## Instalar en el celular

Abre https://peruviansundae.github.io/PowerSpeak/ una vez con internet. Después
funciona **sin conexión**.

**Android (Chrome)**
1. Abre el enlace en Chrome.
2. Toca el menú **⋮** → **Instalar app** (o **Agregar a pantalla principal**).
3. Abre PowerSpeak desde el ícono, como cualquier otra app.

**iPhone / iPad (Safari)**
1. Abre el enlace en **Safari** (en iOS, otros navegadores no siempre permiten
   instalar).
2. Toca **Compartir** (el cuadrado con la flecha) → **Agregar a pantalla de
   inicio** → **Agregar**.

**Si el audio no suena o sale un aviso de «no hay voz»**, instala la voz del
idioma en el sistema:
- **Android**: Ajustes → Texto a voz (motor de Google) → instala los datos de
  voz de portugués, japonés, chino, ruso e inglés.
- **iOS**: Ajustes → Accesibilidad → Contenido leído → Voces.

En PowerSpeak → Ajustes → Audio puedes ver qué voces encontró el navegador y
probarlas.

## Desarrollo local

Requisitos: Node.js 20.19+ (recomendado 22 o 24) y npm.

```bash
npm ci
```

```bash
npm run dev
```

Abre la dirección que muestra la terminal (por ejemplo
http://localhost:5173/PowerSpeak/).

```bash
npm test
```

```bash
npm run build
```

```bash
npm run preview
```

`npm test` corre los tests de Vitest (SM-2, planificador, almacenamiento y
validación de los 5 mazos). `npm run build` revisa los tipos y genera la app
estática en `dist/`; `npm run preview` la sirve en
http://localhost:4173/PowerSpeak/ con el service worker activo.

> Para añadir dependencias usa `npx npm@11 install …`: npm 10 tiene un error
> al resolver Vitest 5. `npm ci` funciona con cualquier versión.

## Desplegar

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instala, corre los
tests, compila y publica en GitHub Pages.

Solo la primera vez: en el repo, **Settings → Pages → Build and deployment →
Source: GitHub Actions**. Para volver a publicar sin cambios: pestaña
**Actions** → «Desplegar en GitHub Pages» → **Run workflow**.

La app se sirve bajo `/PowerSpeak/` (la `base` de `vite.config.ts`). Si algún
día se aloja en la raíz de un dominio, cambia `base` a `'/'`.

## Mazos

Están en `public/decks/<idioma>.json` (`pt`, `ja`, `zh`, `ru`, `en`) y siguen el
esquema de `docs/SPEC.md` (sección 6.1). Al editarlos:

- No cambies ni reutilices los `id` (`ja-0001`…): el progreso guardado depende
  de ellos. Las tarjetas nuevas van al final con el siguiente número.
- Japonés: `reading` en hiragana; chino: pinyin con marcas de tono, **una
  sílaba por carácter separada por espacios**; ruso: acento con U+0301.
- Sube `version` del mazo y corre `npm test`: `tests/decks.test.ts` revisa el
  esquema, los ids, los tonos, las lecturas y los acentos.

## Estructura

```
src/
  App.tsx              navegación entre pantallas
  types.ts             modelo de datos (Card, ReviewState, Settings…)
  srs/sm2.ts           algoritmo SM-2 (funciones puras)
  srs/scheduler.ts     cola de la sesión
  db/storage.ts        IndexedDB, racha, exportar/importar
  decks/loadDeck.ts    carga y validación de mazos
  tts/speak.ts         voz por idioma y avisos
  components/          pantallas y tarjeta (Ruby = furigana/pinyin)
  styles/app.css
public/decks/          mazos JSON
tests/                 tests de Vitest
docs/SPEC.md           especificación del MVP
```
