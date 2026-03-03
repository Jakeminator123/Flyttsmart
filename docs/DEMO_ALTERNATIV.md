# Alternativ startsida via /demo

För att visa den alternativa startsidan från `new_front` på `/demo`.

## Lokal utveckling

1. **Lägg till i projektets `.env.local`:**
   ```
   DEMO_ALTERNATIV_URL=http://localhost:2222
   ```

2. **Starta båda apparna** (i två terminaler):
   ```bash
   # Terminal 1 – huvudappen (port 4173)
   npm run dev

   # Terminal 2 – alternativ frontend (port 2222)
   cd new_front && npm run dev
   ```

3. **Besök** [http://localhost:4173/demo](http://localhost:4173/demo)

Du ser då den alternativa startsidan med Dither-bakgrund, 3D-lanyard, Sverige-kartan osv.

## Produktion (Vercel)

För att `/demo` ska visa alternativet i produktion på befintliga domäner:

### 1. Skapa ett nytt Vercel-projekt för new_front

- **Add New** → Project → importera samma repo
- **Root Directory:** `new_front`
- **Framework:** Next.js (auto-detected)

Ge det ett namn, t.ex. `flytta-nu-demo`. Du får en URL typ `flytta-nu-demo.vercel.app`.

### 2. Koppla subdomän (valfritt)

Om du vill använda t.ex. `demo.flyttanu.vercel.app` eller en egen domän:

- I Vercel → flytta-nu-demo-projektet → Settings → Domains
- Lägg till önskad domän och följ DNS-instruktionerna

### 3. Sätt `NEXT_PUBLIC_MAIN_APP_URL` på demo-projektet

I Vercel → flytta-nu-demo → Settings → Environment Variables:
```
NEXT_PUBLIC_MAIN_APP_URL=https://flyttanu.vercel.app
```

### 4. Sätt `DEMO_ALTERNATIV_URL` på huvudappen

I Vercel → huvudapp (flyttanu.vercel.app) → Settings → Environment Variables:
```
DEMO_ALTERNATIV_URL=https://flytta-nu-demo.vercel.app
```
(eller `https://demo.flyttanu.vercel.app` om du kopplat subdomän)

Redeploya huvudappen så att rewrite:n aktiveras.

### 5. Besök produktion

Öppna [https://flyttanu.vercel.app/demo](https://flyttanu.vercel.app/demo) – du ser alternativstartsidan.

## Konfiguration i new_front (lokal)

I `new_front/.env.local` bör `NEXT_PUBLIC_MAIN_APP_URL` peka på huvudappen:
```
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:4173
```

## Fallback

Om `DEMO_ALTERNATIV_URL` inte är satt visas den vanliga `/demo`-sidan (testdata-formuläret).
