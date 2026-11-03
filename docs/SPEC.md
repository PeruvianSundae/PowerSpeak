# PowerSpeak — Documento de traspaso para Claude Code

> **Cómo usar este documento:** pégalo completo como primer mensaje en una sesión nueva de Claude Code (o súbelo al repo como `docs/SPEC.md`). Contiene todo lo decidido hasta el 3 de noviembre de 2026 en el proyecto "Aplicación de aprendizaje de idiomas". La sección 12 trae el prompt inicial listo para pegar.

---

## 1. Resumen

**PowerSpeak** es una aplicación web personal (PWA) para aprender cinco idiomas: **portugués (Brasil), japonés, chino mandarín (simplificado), ruso e inglés**. La usa un solo usuario, MArtin, hispanohablante (Perú), de forma ilimitada y gratuita. Se inspira en Duolingo (estructura, práctica, gamificación personal) y Tandem (conversación realista), pero **sin nada social ni competitivo**: sin ligas, amigos ni rankings.

Esta primera entrega es un **MVP acotado**: flashcards con repetición espaciada, audio con la voz del navegador y mazos iniciales por idioma. La visión completa (lecciones, conversación con IA, historias, etc.) queda documentada en la sección 10 como hoja de ruta.

## 2. Contexto y restricciones (leer antes de empezar)

| Tema | Detalle |
|---|---|
| Usuario | MArtin, hispanohablante. **Toda la interfaz, comentarios al usuario y explicaciones en español.** El código y los nombres de archivos pueden ir en inglés. |
| Presupuesto | **~USD 25** de créditos de sesiones en la nube de Claude Code. El resto de los créditos está reservado para otro proyecto (SmartBasket AI / TiendaStock), que es la prioridad. No gastar de más: nada de trabajo redundante ni refactors innecesarios. |
| Fecha límite | Los créditos **vencen el 5 de noviembre de 2026 a las ~2:59 a.m. (hora de Perú, GMT-5)**, es decir ~07:59 UTC. El MVP debe estar desplegado antes. |
| Repositorio | **[github.com/PeruvianSundae/PowerSpeak](https://github.com/PeruvianSundae/PowerSpeak)**, rama `main`. Creado el 3 nov 2026 con un solo commit: `README.md` (2 líneas) y `.gitignore` de Node. Sin licencia. Es **público** y se publica en GitHub Pages (sección 11). |
| Hosting | **GitHub Pages** (gratis, repo público). Sin servidor, sin base de datos remota, sin cuentas. Debe servirse por HTTPS para que la PWA se pueda instalar. |
| Dispositivos | Principalmente el celular (Android/iOS vía navegador, instalable como PWA) y también escritorio. Debe funcionar **offline** después de la primera carga. |
| Costos recurrentes | Cero. Ninguna API de pago en el MVP. |

## 3. Alcance del MVP

### Incluido
1. **Selección de idioma**: pantalla de inicio con los 5 idiomas, cada uno con su contador de tarjetas pendientes hoy y nuevas disponibles.
2. **Flashcards con repetición espaciada (SM-2)**:
   - Anverso: palabra en el idioma objetivo (con furigana / pinyin / acento según idioma) y botón de audio.
   - Reverso: significado en español, lectura/romanización, ejemplo corto con traducción.
   - Cuatro botones de calificación estilo Anki: **Otra vez / Difícil / Bien / Fácil**, mostrando el próximo intervalo de cada uno.
   - Modo inverso opcional (español → idioma objetivo) como ajuste por idioma.
3. **Audio (TTS)** con la Web Speech API (`speechSynthesis`), voz del navegador para `pt-BR`, `ja-JP`, `zh-CN`, `ru-RU`, `en-US`. Reproducción automática opcional al mostrar la tarjeta. Si no hay voz instalada para ese idioma, mostrar un aviso en español con cómo instalarla (Android: Ajustes → Texto a voz; iOS: Ajustes → Accesibilidad → Contenido leído).
4. **Mazos iniciales**: ~100 palabras de alta frecuencia por idioma (nivel A1), en JSON versionado.
5. **Furigana** para japonés (`<ruby>` con lectura en hiragana, activable/desactivable) y **pinyin con marcas de tono** para chino (activable). Ruso con **acento tónico** marcado (ej. молоко́). Romanización opcional para japonés, chino y ruso.
6. **Progreso básico**: racha de días (streak), tarjetas repasadas hoy, total aprendidas por idioma, tiempo de estudio aproximado.
7. **Ajustes**: nuevas tarjetas por día por idioma (por defecto 10), máximo de repasos por día (por defecto 200), autoplay de audio, mostrar furigana/pinyin/romanización, velocidad del habla, tema claro/oscuro.
8. **Exportar / importar** el progreso como archivo JSON (respaldo manual, ya que todo vive en el navegador).
9. **PWA instalable y offline**: manifest, íconos, service worker que precachea la app y los mazos.
10. **Despliegue automático** a GitHub Pages con GitHub Actions al hacer push a `main`.

### Fuera de alcance del MVP (no implementar ahora)
- Conversación con IA, corrección de texto, generación de ejercicios con la API de Claude.
- Reconocimiento de voz / evaluación de pronunciación.
- Lecciones estructuradas, historias, tipos de ejercicio distintos a flashcards.
- Cuentas, sincronización en la nube, backend, notificaciones push.
- Trazos de kanji/hanzi, visuales pedagógicos, plan de estudio.
- Cualquier función social o competitiva (nunca, ni en el futuro).
- Más de ~100 palabras por idioma, i18n de la interfaz a otros idiomas.

## 4. Stack técnico

| Pieza | Elección | Motivo |
|---|---|---|
| Build | **Vite** + **TypeScript** | Rápido, salida estática para Pages. |
| UI | **React 18** | Coincide con la spec original; componentes simples. Sin librerías de UI pesadas: CSS propio (o CSS modules), mobile-first. |
| Persistencia | **IndexedDB** vía `idb` (wrapper pequeño) | Datos locales, sin backend. |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest + service worker + precache de los JSON. |
| Audio | Web Speech API (`speechSynthesis`) | Gratis, offline en la mayoría de dispositivos. |
| Tests | **Vitest** | Tests unitarios del algoritmo SM-2, del planificador de la sesión y de la validación de mazos. |
| Deploy | GitHub Actions → GitHub Pages | `base` de Vite configurado como `/PowerSpeak/` (respetar mayúsculas: es el nombre del repo). |

Mantener las dependencias al mínimo. No usar router pesado: un estado simple de "pantalla actual" o `react-router` en modo hash basta (hash routing evita 404 en Pages).

## 5. Estructura de archivos propuesta

```
PowerSpeak/
├── CLAUDE.md                     # reglas para Claude Code (ver sección 13)
├── README.md                     # ya existe (2 líneas): ampliarlo con uso e instalación
├── .gitignore                    # ya existe (plantilla Node)
├── docs/
│   └── SPEC.md                   # este documento
├── index.html
├── package.json
├── vite.config.ts                # base '/PowerSpeak/', vite-plugin-pwa
├── tsconfig.json
├── public/
│   ├── icons/                    # icon-192.png, icon-512.png, maskable
│   └── decks/
│       ├── pt.json
│       ├── ja.json
│       ├── zh.json
│       ├── ru.json
│       └── en.json
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # navegación entre pantallas
│   ├── types.ts                  # Card, ReviewState, ReviewLog, Settings, Stats
│   ├── srs/
│   │   ├── sm2.ts                # algoritmo puro, sin efectos
│   │   └── scheduler.ts          # arma la cola de la sesión (pendientes + nuevas)
│   ├── db/
│   │   └── storage.ts            # IndexedDB: estados, logs, ajustes, export/import
│   ├── decks/
│   │   └── loadDeck.ts           # fetch + validación del JSON
│   ├── tts/
│   │   └── speak.ts              # selección de voz por idioma, fallback y avisos
│   ├── components/
│   │   ├── LanguagePicker.tsx
│   │   ├── StudySession.tsx
│   │   ├── Flashcard.tsx
│   │   ├── Ruby.tsx              # furigana / pinyin con <ruby>
│   │   ├── GradeButtons.tsx
│   │   ├── Stats.tsx
│   │   └── Settings.tsx
│   └── styles/
│       └── app.css
├── tests/
│   ├── sm2.test.ts
│   ├── scheduler.test.ts
│   └── decks.test.ts             # valida esquema y ids únicos de los 5 mazos
└── .github/workflows/deploy.yml
```

## 6. Modelo de datos

### 6.1 Tarjeta (contenido, en `public/decks/<lang>.json`)

```ts
type LangCode = 'pt' | 'ja' | 'zh' | 'ru' | 'en';

interface Deck {
  lang: LangCode;
  name: string;          // "Japonés"
  ttsLang: string;       // "ja-JP"
  version: number;       // subir cuando cambie el contenido
  cards: Card[];
}

interface Card {
  id: string;            // "ja-0001", único y estable (no reutilizar)
  term: string;          // forma escrita: "水", "молоко́", "água"
  reading?: string;      // ja: hiragana "みず"; zh: pinyin con tonos "shuǐ"
  romanization?: string; // ja: "mizu"; ru: "molokó"; zh: puede omitirse (reading ya es pinyin)
  meaning: string;       // en español: "agua"
  pos: 'sustantivo' | 'verbo' | 'adjetivo' | 'adverbio' | 'pronombre' | 'expresión' | 'número' | 'otro';
  example?: { text: string; reading?: string; translation: string };
  tags: string[];        // ["A1", "comida"]
  rank: number;          // orden de introducción (1 = primera)
  notes?: string;        // nota breve en español (falsos amigos, uso, etc.)
}
```

Reglas de contenido por idioma:
- **Portugués (Brasil)**: incluir notas de falsos amigos con el español cuando aplique (ej. *esquisito*, *polvo*).
- **Japonés**: `term` en la forma más común (kanji si es habitual, si no kana); `reading` en hiragana; `romanization` en Hepburn. Incluir algunos saludos/expresiones.
- **Chino**: caracteres simplificados; `reading` en pinyin con marcas de tono (no números).
- **Ruso**: `term` con acento tónico marcado (U+0301); `romanization` opcional.
- **Inglés**: incluir algunos phrasal verbs muy frecuentes; pronunciación via TTS.
- Seleccionar por frecuencia y utilidad (pronombres, verbos básicos, números 1–10, saludos, comida, tiempo, familia, lugares). Ejemplos cortos de nivel A1.
- El contenido lo genera Claude: **revisar consistencia** (tonos, lecturas, acentos) con un test que valide el esquema y una revisión manual de una muestra.

### 6.2 Estado de repaso (IndexedDB, store `reviews`, clave `cardId`)

```ts
interface ReviewState {
  cardId: string;
  lang: LangCode;
  reps: number;          // repeticiones correctas seguidas
  lapses: number;        // veces olvidada
  ease: number;          // factor de facilidad, inicia en 2.5, mínimo 1.3
  interval: number;      // días
  due: string;           // ISO date (YYYY-MM-DD) del próximo repaso
  lastReviewed: string;  // ISO datetime
  state: 'learning' | 'review' | 'relearning';
  step?: number;         // índice en los pasos de aprendizaje
}
```

### 6.3 Otros stores
- `logs`: `{ id, cardId, lang, grade, reviewedAt, elapsedMs }` (para estadísticas y streak).
- `settings`: un documento con los ajustes globales y por idioma.
- `meta`: `{ streak, lastStudyDate, newIntroducedToday: Record<LangCode, number>, dayKey }`.

El export/import vuelca y restaura `reviews`, `logs`, `settings` y `meta` en un solo JSON con `schemaVersion`.

## 7. Algoritmo de repetición espaciada (SM-2 adaptado, estilo Anki)

Calificaciones: **Otra vez = 0**, **Difícil = 1**, **Bien = 2**, **Fácil = 3**.

**Tarjetas nuevas / en aprendizaje** (pasos: 1 min, 10 min):
- Otra vez → vuelve al paso 0 (reaparece en ~1 min dentro de la sesión).
- Difícil → repite el paso actual.
- Bien → avanza al siguiente paso; al terminar los pasos pasa a `review` con `interval = 1` día.
- Fácil → pasa directo a `review` con `interval = 4` días.

**Tarjetas en repaso**:
- Otra vez → `lapses++`, `ease -= 0.20`, pasa a `relearning` (paso de 10 min), luego `interval = max(1, round(interval * 0.5))`.
- Difícil → `ease -= 0.15`, `interval = max(interval + 1, round(interval * 1.2))`.
- Bien → `interval = max(interval + 1, round(interval * ease))`.
- Fácil → `ease += 0.15`, `interval = max(interval + 1, round(interval * ease * 1.3))`.
- `ease` siempre en el rango [1.3, 3.0]. `due = hoy + interval`.

**Cola de la sesión** (`scheduler.ts`): primero las tarjetas en aprendizaje vencidas, luego los repasos con `due <= hoy` (ordenados por `due`), intercalando nuevas hasta el límite diario, en orden de `rank`. El "día" se corta a las 4:00 a.m. hora local (como Anki), para que estudiar de madrugada cuente al día anterior.

Todo esto debe ser **funciones puras** con tests (incluyendo los límites de `ease` y la fecha de corte).

## 8. Pantallas y flujo

1. **Inicio**: 5 tarjetas de idioma (bandera o emoji + nombre + "X pendientes · Y nuevas"), racha actual arriba, acceso a Estadísticas y Ajustes.
2. **Sesión de estudio**: barra de progreso, tarjeta, "Mostrar respuesta" (o tocar la tarjeta), botones de calificación con intervalo previsto, botón 🔊. Atajos de teclado en escritorio: espacio = mostrar, 1–4 = calificar, R = repetir audio.
3. **Fin de sesión**: resumen en español (tarjetas repasadas, nuevas aprendidas, % de aciertos, racha) y botón "Volver al inicio".
4. **Estadísticas**: por idioma, aprendidas / en aprendizaje / sin ver, repasos de los últimos 7 días, racha.
5. **Ajustes**: los de la sección 3, más Exportar / Importar / Reiniciar progreso de un idioma (con confirmación).

Diseño limpio, mobile-first, botones grandes, alto contraste, modo oscuro. Tipografías del sistema con soporte CJK y cirílico (`system-ui, "Noto Sans JP", "Noto Sans SC", sans-serif`).

## 9. Criterios de aceptación

El MVP está terminado cuando:

- [ ] `npm run build` genera una app estática y `npm test` pasa (SM-2, scheduler, validación de los 5 mazos).
- [ ] La app está publicada por HTTPS mediante GitHub Actions: en `https://peruviansundae.github.io/PowerSpeak/`.
- [ ] Se puede instalar en el celular ("Agregar a pantalla de inicio") y abre **sin internet** después de la primera visita, con los 5 mazos disponibles.
- [ ] Los 5 idiomas tienen ~100 tarjetas cada uno, con ids únicos, significado en español y ejemplo.
- [ ] Japonés muestra furigana sobre los kanji y chino muestra pinyin con tonos; ambos se pueden ocultar desde Ajustes. Ruso muestra el acento tónico.
- [ ] El botón 🔊 lee la palabra con la voz del idioma correcto; si no hay voz, aparece el aviso en español.
- [ ] Calificar una tarjeta actualiza su intervalo según la sección 7, y el progreso **persiste** al cerrar y reabrir la app.
- [ ] El límite de nuevas por día se respeta y se reinicia al día siguiente (corte 4:00 a.m.).
- [ ] La racha sube al estudiar al menos una tarjeta en el día y se reinicia si se salta un día.
- [ ] Exportar genera un JSON e importarlo en otro navegador restaura el progreso.
- [ ] Toda la interfaz está en español.
- [ ] El README explica cómo correrlo local, cómo desplegar y cómo instalarlo en Android/iOS.

## 10. Visión completa y hoja de ruta (después del MVP, solo referencia)

Esta es la especificación de producto completa acordada en el proyecto. **No implementar en el MVP**; sirve para no tomar decisiones que la bloqueen.

**Módulos, por prioridad:**
1. Núcleo: perfil, selección de idioma, nivel A1–C2 por idioma, persistencia. *(parcialmente en el MVP)*
2. Repetición espaciada: SM-2 en el MVP; migrar a **FSRS** más adelante. Vocabulario, gramática y frases, con interleaving. *(MVP)*
3. Lecciones estructuradas: unidades y habilidades de 5 a 12 minutos con dificultad adaptativa. Ejercicios: traducción directa e inversa, completar espacios, escuchar y escribir, escuchar y elegir, ordenar palabras, emparejar, corregir errores, hablar y producción libre.
4. Conversación tipo Tandem con la API de Claude (la clave la pone el usuario en Ajustes, nunca en el repo): roles (amigo, colega, cliente…), corrección natural y no invasiva, versión más natural o más formal de cada frase, nivel y velocidad ajustables.
5. Historias interactivas cortas con preguntas de comprensión (estilo Duolingo Stories).
6. Progreso personal: nivel estimado A1–C2, fortalezas y debilidades, vocabulario y gramática dominados vs. pendientes, rachas, tiempo total, resumen al final de cada sesión con errores principales y recomendación de qué practicar después.
7. Visuales pedagógicos: tablas de conjugación y casos, mapas de tonos, trazos de kanji y hanzi, concept maps.
8. Plan de estudio por idioma y número de días.

**Pedagogía que la app debe aplicar:** Pareto 80/20, active recall, repetición espaciada, práctica deliberada sobre los errores registrados, método Socrático y Feynman (no dar la respuesta si el usuario puede descubrirla), uso máximo del idioma objetivo según el nivel, explicaciones en español. Exigente pero amable, sin presión social.

**Enfoque por idioma:**
- Japonés: hiragana, katakana, kanji progresivos, partículas, keigo, estructura de frases, furigana activable.
- Chino: tonos (con feedback), hanzi, clasificadores (palabras de medida), patrones.
- Ruso: cirílico, casos, aspecto verbal, verbos de movimiento, acento tónico.
- Portugués: contraste con el español, falsos amigos, pronunciación, verbos, expresiones.
- Inglés: phrasal verbs, collocations, matices, naturalidad y registro.

**Comandos rápidos de la visión original** (para inspirar la navegación futura): `/leccion [idioma] [tema]`, `/conversacion [idioma] [tema o nivel]`, `/repaso [idioma]`, `/vocabulario [idioma]`, `/gramatica [idioma] [tema]`, `/historia [idioma]`, `/evaluacion [idioma]`, `/progreso`, `/visual [tema]`, `/plan [idioma] [días]`.

## 11. Estado del repositorio y pasos pendientes de MArtin

**Estado verificado el 3 nov 2026:** el repo [PeruvianSundae/PowerSpeak](https://github.com/PeruvianSundae/PowerSpeak) existe, rama `main`, un commit inicial con `README.md` y `.gitignore` de Node, **sin licencia**, **público** (cambiado el 3 nov 2026) y sin GitHub Pages activado todavía.

**Hosting (decidido el 3 nov 2026):** el repo pasa a **público** y la app se publica gratis en **GitHub Pages**, en `https://peruviansundae.github.io/PowerSpeak/`. El proyecto no tiene secretos, así que no hay riesgo.

**Pasos:**
1. ~~Hacer el repo público~~ (hecho).
2. Dar acceso a Claude en [claude.ai/connect-github](https://claude.ai/connect-github) si aún no lo tiene.
3. Abrir [claude.ai/code](https://claude.ai/code), elegir el repo `PeruvianSundae/PowerSpeak` y pegar el prompt de la sección 12 (o este documento completo).
4. Cuando el primer PR esté fusionado, en el repo ir a **Settings → Pages → Source: GitHub Actions**.
5. Opcional: agregar una licencia (por ejemplo MIT) si algún día se publica el código.

## 12. Prompt inicial para Claude Code (copiar y pegar)

```
Vas a construir PowerSpeak, una PWA personal para aprender portugués (Brasil),
japonés, chino mandarín, ruso e inglés. El usuario es hispanohablante: toda la
interfaz y tus mensajes deben estar en español.

La especificación completa está en docs/SPEC.md (si no existe, créala con el
documento que te pego abajo y haz commit). Síguela al pie de la letra:
sección 3 (alcance del MVP), 4 (stack), 5 (estructura), 6 (modelo de datos),
7 (algoritmo SM-2) y 9 (criterios de aceptación). La sección 10 es solo
referencia futura: NO la implementes.

Repo: PeruvianSundae/PowerSpeak (rama main; ya tiene README.md y .gitignore
de Node, no los sobrescribas, amplíalos).

Restricciones importantes:
- Presupuesto muy limitado (~25 USD) y fecha límite: 5 nov 2026, 02:59 hora de
  Perú. Prioriza tener algo funcional desplegado; evita trabajo redundante,
  dependencias innecesarias y refactors.
- Sin backend, sin APIs de pago, todo offline en el navegador.

Orden de trabajo (un commit por paso, y un PR al final de cada bloque):
1. Esqueleto Vite + React + TS, vite-plugin-pwa, CLAUDE.md, workflow de
   GitHub Pages, base '/PowerSpeak/'.
2. src/srs/sm2.ts y scheduler.ts con tests en Vitest.
3. Persistencia en IndexedDB (idb) + export/import.
4. UI: inicio, sesión de flashcards, fin de sesión, estadísticas, ajustes.
   Furigana/pinyin con <ruby>, acento tónico en ruso, TTS con speechSynthesis.
5. Mazos: ~100 palabras A1 por idioma en public/decks/*.json, con test que
   valide el esquema e ids únicos. Revisa tonos, lecturas y acentos.
6. README con instrucciones de uso e instalación en el celular.

Antes de cada PR corre `npm test` y `npm run build`. Al terminar, recorre la
lista de criterios de aceptación de la sección 9 y dime cuáles cumpliste y
cuáles no. Empieza por el paso 1.

--- docs/SPEC.md ---
[pega aquí este documento completo]
```

## 13. `CLAUDE.md` sugerido para el repo

```markdown
# PowerSpeak — reglas para Claude Code

- Proyecto: PWA personal de idiomas (pt, ja, zh, ru, en). Spec en docs/SPEC.md.
- Usuario hispanohablante: UI, README y mensajes al usuario en español.
  Código, nombres de variables y commits pueden ir en inglés.
- Stack: Vite + React + TypeScript, idb, vite-plugin-pwa, Vitest. No añadir
  dependencias sin necesidad clara.
- Sin backend ni APIs de pago. Todo debe funcionar offline.
- La lógica SRS (src/srs) es pura y siempre lleva tests.
- Los mazos (public/decks/*.json) deben pasar tests/decks.test.ts; los ids de
  tarjetas son estables y nunca se reutilizan.
- Antes de cada PR: `npm test` y `npm run build` sin errores.
- Presupuesto ajustado: cambios pequeños y enfocados, sin refactors no pedidos.
- Nada social ni competitivo, nunca.
```

## 14. Historial de decisiones (para contexto)

- **1 nov 2026**: MArtin propuso un prompt de "tutor personal de idiomas" (estilo Duolingo + Tandem, sin lo social). Se reescribió como especificación de producto (sección 10), ya que el objetivo es *programar* una app, no que Claude actúe como tutor en el chat.
- **1 nov 2026**: los USD 100 son créditos de sesiones en la nube de Claude Code y vencen el 5 nov. Primero se planteó un tope de USD 50 para idiomas; luego se priorizó **SmartBasket AI** (ERP offline para bodegas en Perú, Python + SQLite + Streamlit) y el tope para idiomas bajó a **~USD 25**.
- **3 nov 2026**: con ~USD 25, se recomendó un **MVP mínimo**: PWA estática offline en GitHub Pages con flashcards SRS, TTS del navegador, ~100 palabras por idioma, furigana y pinyin. Se descartó para el MVP todo lo que requiere IA o backend.
- **3 nov 2026**: MArtin bautizó la app como **PowerSpeak**, pidió este documento de traspaso y creó el repo `PeruvianSundae/PowerSpeak` (privado) y decidió hacerlo público para publicar en GitHub Pages.

## Anexo A. Prompt original de MArtin (texto íntegro)

````markdown
# Language Mastery App – Tutor Personal de Idiomas

Eres una aplicación personal de aprendizaje de idiomas de alto rendimiento, especializada exclusivamente en:
- Portugués
- Japonés
- Ruso
- Chino (Mandarín)
- Inglés

Tu objetivo es ayudarme a dominar estos idiomas de forma rápida, profunda y sostenible, combinando lo mejor de Duolingo (estructura, práctica deliberada y gamificación personal) y Tandem (conversación realista y corrección natural), pero sin elementos sociales ni de competencia.

---

## Funciones principales de la aplicación

### 1. Sistema de Lecciones Estructuradas (estilo Duolingo)
- Organiza el aprendizaje en **unidades y habilidades** claras.
- Cada lección es corta (5-12 minutos).
- Combina: vocabulario + gramática + comprensión + producción.
- Usa dificultad adaptativa (más fácil si fallo, más difícil si acierto).

### 2. Tipos de ejercicios disponibles
- Traducción (directa e inversa)
- Completar espacios
- Escuchar y escribir
- Escuchar y elegir
- Hablar (me pides que diga frases y me corriges)
- Ordenar palabras
- Emparejar
- Corregir errores
- Producción libre (escribir o hablar sobre un tema)
- Historias cortas interactivas (estilo Duolingo Stories)

### 3. Conversación realista (estilo Tandem)
- Simula conversaciones naturales sobre temas reales.
- Adapta el nivel de dificultad y la velocidad.
- Corrige de forma natural (como un compañero de intercambio, no como un profesor estricto).
- Ofrece versiones más naturales o más formales de lo que digo.
- Puede hacer de diferentes roles (amigo, colega, cliente, etc.).

### 4. Sistema de progreso personal
- Lleva un registro de:
  - Nivel estimado por idioma (A1–C2)
  - Fortalezas y debilidades
  - Vocabulario y gramática dominados vs. pendientes
  - Rachas de estudio (streaks personales)
  - Tiempo total de práctica
- Al final de cada sesión muestra un resumen claro de progreso.

### 5. Spaced Repetition + Active Recall inteligente
- Genera sesiones de repaso personalizadas según lo que más necesito.
- Prioriza lo que estoy a punto de olvidar.
- Mezcla vocabulario, gramática y frases reales (interleaving).

### 6. Material visual de apoyo
- Genera diagramas, tablas, concept maps, flujos de conjugación, mapas de caracteres/tonos, etc. cuando ayuden a entender mejor.
- Los visuales deben ser claros, limpios y pedagógicos.

---

## Métodos de enseñanza obligatorios

Siempre combina:
1. **Pareto 80/20** → Qué es realmente importante ahora
2. **Feynman + Método Socrático** → Entendimiento profundo
3. **Active Recall** → Me haces recuperar la información
4. **Spaced Repetition** → Revisiones inteligentes
5. **Práctica deliberada** → Ejercicios enfocados en mis debilidades

---

## Cómo debes interactuar

- Al inicio de cada sesión pregunta:
  "¿En qué idioma quieres trabajar hoy y qué tipo de práctica prefieres?"
  (Opciones rápidas: Lección estructurada / Conversación / Repaso / Vocabulario / Gramática / Historia / Evaluación)

- Sé paciente, claro y exigente de forma amable.
- Corrige los errores importantes, pero no interrumpas constantemente.
- Usa el idioma objetivo lo máximo posible según mi nivel.
- Cuando genere ejercicios, hazlos uno por uno y espera mi respuesta.
- Al final de cada sesión entrega:
  - Resumen de lo practicado
  - Errores principales
  - Recomendación de qué practicar después
  - Progreso actualizado

---

## Comandos rápidos

- `/leccion [idioma] [tema]` → Empieza una lección estructurada
- `/conversacion [idioma] [tema o nivel]` → Practica conversación realista
- `/repaso [idioma]` → Sesión de Spaced Repetition
- `/vocabulario [idioma]` → Práctica intensiva de vocabulario
- `/gramatica [idioma] [tema]` → Explicación + ejercicios de gramática
- `/historia [idioma]` → Historia interactiva
- `/evaluacion [idioma]` → Evalúa mi nivel actual
- `/progreso` → Muestra mi estado general
- `/visual [tema]` → Genera material visual de apoyo
- `/plan [idioma] [días]` → Crea un plan de estudio personalizado

---

## Enfoque especial por idioma

- **Japonés**: Partículas, keigo, kanji progresivos, estructura de frases
- **Chino**: Tonos, caracteres, medida de palabras, patrones
- **Ruso**: Casos, aspecto verbal, verbos de movimiento
- **Portugués**: Diferencias con el español, pronunciación, verbos, expresiones
- **Inglés**: Phrasal verbs, collocations, matices y naturalidad

---

## Reglas finales

- Nunca me des la respuesta directa si puedo descubrirla.
- Prioriza la práctica activa sobre la explicación pasiva.
- Adapta constantemente la dificultad a mi rendimiento real.
- Mantén la experiencia personal, motivadora y sin presión social.

Empieza ahora preguntando:
"¿En qué idioma y con qué tipo de práctica quieres empezar hoy?"
````

## Anexo B. Especificación de producto completa propuesta el 1 nov 2026 (texto íntegro)

````markdown
# Proyecto: App personal de idiomas (PT, JA, RU, ZH, EN)

## Objetivo
Construir una aplicación web (PWA, usable en móvil y escritorio) para uso personal e ilimitado de un solo usuario (MArtin, hispanohablante). Idiomas: Portugués (Brasil), Japonés, Ruso, Chino mandarín (simplificado + pinyin) e Inglés. Las funciones son como Duolingo y Tandem, SIN nada social ni competitivo (sin ligas, amigos ni rankings).

## Stack recomendado (los hilos pueden proponer alternativas justificadas)
- Frontend: React + TypeScript + Vite, PWA con modo offline.
- Datos: almacenamiento local (IndexedDB) con exportar e importar en JSON. Sin backend obligatorio.
- IA: API de Claude (la clave la pone el usuario en Ajustes, nunca en el repo) para conversación, corrección y generación de ejercicios.
- Voz: Web Speech API (TTS y reconocimiento) y, opcionalmente, un TTS de mejor calidad.

## Módulos (por orden de prioridad)
1. Núcleo: perfil, selección de idioma, nivel A1–C2 por idioma, persistencia.
2. Repetición espaciada: algoritmo FSRS (o SM-2) para vocabulario, gramática y frases, con interleaving.
3. Lecciones estructuradas: unidades y habilidades de 5 a 12 minutos con dificultad adaptativa. Ejercicios: traducción directa e inversa, completar, escuchar y escribir, escuchar y elegir, ordenar palabras, emparejar, corregir errores, hablar y producción libre.
4. Conversación tipo Tandem: roles (amigo, colega, cliente…), corrección natural y no invasiva, versión más natural o formal de cada frase, nivel ajustable.
5. Historias interactivas cortas con preguntas de comprensión.
6. Progreso personal: rachas, tiempo de práctica, fortalezas y debilidades, resumen al final de cada sesión y recomendación de qué practicar después.
7. Visuales pedagógicos: tablas de conjugación y casos, mapas de tonos, trazos de kanji y hanzi, concept maps.
8. Plan de estudio: generar un plan por idioma y número de días.

## Pedagogía que la app debe aplicar (en prompts y diseño)
Pareto 80/20, active recall, repetición espaciada, práctica deliberada sobre los errores registrados, método Socrático y Feynman (no dar la respuesta si el usuario puede descubrirla) y uso máximo del idioma objetivo según el nivel. Explicaciones en español.

## Enfoque por idioma
- Japonés: hiragana, katakana, kanji progresivos, partículas, keigo, furigana activable.
- Chino: tonos (con feedback), hanzi, clasificadores, patrones.
- Ruso: cirílico, casos, aspecto verbal, verbos de movimiento, acento tónico.
- Portugués: contraste con el español, falsos amigos, pronunciación.
- Inglés: phrasal verbs, collocations, naturalidad y registro.

## Cómo trabajar
- Repositorio único en GitHub. Cada funcionalidad va en su hilo y su PR, con tests básicos.
- Avanzar por módulos en el orden de arriba. Primero algo usable de punta a punta y después profundizar.
- Contenido semilla (vocabulario frecuente A1–A2) en archivos JSON versionados por idioma.
- Interfaz en español, limpia y motivadora.
- Presupuesto: el usuario tiene unos 100 USD en créditos de Claude y quiere aprovecharlos al máximo en construir y ampliar la app. Se prioriza calidad y cobertura (más contenido, más tipos de ejercicio, más pulido) sobre el ahorro, pero sin trabajo redundante.
````

> Nota: el punto de presupuesto del Anexo B quedó superado. El presupuesto vigente es **~USD 25** (sección 2).
