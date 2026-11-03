# CLAUDE.md — PowerSpeak

PWA personal para aprender portugués (Brasil), japonés, chino mandarín, ruso e
inglés. El usuario es hispanohablante.

## Reglas
- **Todo en español**: interfaz, mensajes, commits y PRs.
- La especificación es `docs/SPEC.md`. Síguela al pie de la letra
  (secciones 3, 4, 5, 6, 7 y 9). **No implementes la sección 10** (solo es
  referencia futura).
- Sin backend, sin APIs de pago: todo corre offline en el navegador
  (IndexedDB + service worker).
- Presupuesto y plazo ajustados: prioriza algo funcional y desplegado. Nada de
  dependencias innecesarias, refactors ni trabajo redundante.
- No sobrescribas `README.md` ni `.gitignore`: amplíalos.

## Stack
Vite + React + TypeScript, `vite-plugin-pwa` (Workbox), Vitest. Sin router:
la navegación entre pantallas es por estado en React (evita 404 en GitHub
Pages).

## Comandos
- `npm run dev` — servidor de desarrollo.
- `npm test` — tests con Vitest (`vitest run`).
- `npm run build` — `tsc --noEmit` + build de producción en `dist/`.
- `npm run preview` — sirve `dist/` localmente.

Antes de cada PR: `npm test` y `npm run build` deben pasar.

## Despliegue
GitHub Pages con `.github/workflows/deploy.yml` (push a `main`). La `base` de
Vite es `/PowerSpeak/`; si el hosting cambia, usa `base: '/'` y elimina el
workflow. En el repo: Settings → Pages → Source: **GitHub Actions**.

## Estructura (prevista)
- `src/srs/` — `sm2.ts` (algoritmo SM-2) y `scheduler.ts` (cola de repaso).
- `src/` — persistencia en IndexedDB (`idb`), export/import y pantallas.
- `public/decks/*.json` — mazos A1 (~100 palabras por idioma), precacheados
  por el service worker.
- `public/icons/` — íconos de la PWA (`icon.svg` es la fuente).

## Notas
- npm 10 falla al resolver Vitest 5 (`Cannot read properties of null
  (reading 'edgesOut')`); para añadir o actualizar dependencias usa
  `npx npm@11 install ...`. `npm ci` con el lockfile funciona con npm 10.
