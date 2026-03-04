# Alternativ startsida — separat repo

Den alternativa startsidan (3D-lanyard, dither-bakgrund, Sverige-karta etc.)
lever i ett **eget Git-repo** och deployar som ett fristående Vercel-projekt.

Huvudappen kan proxya den via `/demo` med en rewrite.

## Arkitektur

```
flytta-nu  (detta repo)          flytta-nu-front  (separat repo)
├── app/                          ├── app/
├── next.config.mjs               ├── next.config.mjs
│   └─ rewrites → DEMO_URL        ├── components/ui/lanyard.tsx
├── ...                           ├── public/countries-110m.json
                                  ├── styles/slider.css
                                  └── package.json
```

## Lokal utveckling

1. Klona det separata repot bredvid huvudappen:
   ```
   cd ~/dev/projects
   git clone <url> flytta-nu-front
   ```

2. Lägg till i huvudappens `.env.local`:
   ```
   DEMO_ALTERNATIV_URL=http://localhost:2222
   ```

3. Starta båda apparna (i två terminaler):
   ```powershell
   # Terminal 1 – huvudappen (port 4173)
   npm run dev

   # Terminal 2 – alternativ frontend (port 2222)
   cd ../flytta-nu-front
   npm run dev
   ```

4. Besök http://localhost:4173/demo

## Produktion (Vercel)

### 1. Skapa Vercel-projekt för det nya repot

- **Add New** → Project → importera `flytta-nu-front`-repot
- Framework: Next.js (auto-detected)
- Ge det ett namn, t.ex. `flytta-nu-demo`

### 2. Sätt env-variabler

**På demo-projektet** (flytta-nu-demo):
```
NEXT_PUBLIC_MAIN_APP_URL=https://flyttanu.vercel.app
```

**På huvudappen** (flyttanu):
```
DEMO_ALTERNATIV_URL=https://flytta-nu-demo.vercel.app
```

Redeploya huvudappen så att rewrite:n aktiveras.

### 3. Besök produktion

Öppna https://flyttanu.vercel.app/demo — du ser alternativstartsidan.

## Fallback

Om `DEMO_ALTERNATIV_URL` inte är satt visas den vanliga `/demo`-sidan (testdata-formuläret).

## Flytta filerna

De tre filerna som idag ligger i `new_front/` i detta repo ska flyttas till det nya repot:

- `new_front/components/ui/lanyard.tsx` → `components/ui/lanyard.tsx`
- `new_front/public/countries-110m.json` → `public/countries-110m.json`
- `new_front/styles/slider.css` → `styles/slider.css`

Efter flytten kan `new_front/`-mappen i detta repo tas bort.
