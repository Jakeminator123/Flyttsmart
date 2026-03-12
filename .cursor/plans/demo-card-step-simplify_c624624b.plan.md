---
name: demo-card-step-simplify
overview: Ge `adressandring` samma stilrena kortspråk som demo-/hero-ytan, förenkla formulärflödet från 4 till 3 steg och buggsäkra mini-MIF/steghantering utan att göra UI:t tyngre. Avsluta med verifiering och förbered push till `origin/master`.
todos: []
isProject: false
---

# Demo-kort och enklare stegflöde

## Mål

Göra `adressandring` visuellt närmare demo-/hero-uttrycket men hålla det lättviktigt: återanvänd befintligt kortspråk, lägg till subtil 3D-känsla via befintlig CSS och minska friktionen genom att gå från 4 steg till 3.

Nuvarande demo är inte en lokal sida utan en redirect i [C:\Users\jakem\dev\projects\flytta_nu\next.config.mjs](C:\Users\jakem\dev\projects\flytta_nu\next.config.mjs), så den säkraste vägen är att lyfta in dess visuella principer i befintliga komponenter i stället för att försöka kopiera en separat vy.

```9:17:next.config.mjs
      {
        source: "/demo",
        destination: "https://new-front-nine.vercel.app/",
        permanent: false,
      },
```

## Kodbas att bygga på

Formkortet i [C:\Users\jakem\dev\projects\flytta_nu\app\adressandring\page.tsx](C:\Users\jakem\dev\projects\flytta_nu\app\adressandring\page.tsx) är redan den bästa basen för move-flowet:

```478:486:app/adressandring/page.tsx
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-linear-to-b from-hero-gradient-from to-background overflow-hidden">
```

```523:548:app/adressandring/page.tsx
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 transition-all duration-300",
                    isActive
                      ? "scale-105"
                      : isComplete
                        ? "cursor-pointer opacity-80 hover:opacity-100"
                        : "opacity-40 cursor-default"
                  )}
```

Och den subtila 3D-interaktionen finns redan i [C:\Users\jakem\dev\projects\flytta_nu\app\globals.css](C:\Users\jakem\dev\projects\flytta_nu\app\globals.css):

```709:723:app/globals.css
.card-3d {
  transform-style: preserve-3d;
  transform: perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0);
  transition:
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.card-3d:hover {
  transform: perspective(800px) rotateX(3deg) rotateY(-3deg) translateY(-4px);
```

Hero-kortet är också en bra stilreferens för fritext/mini-MIF-surface i [C:\Users\jakem\dev\projects\flytta_nu\components\hero-section.tsx](C:\Users\jakem\dev\projects\flytta_nu\components\hero-section.tsx):

```125:128:components/hero-section.tsx
          <motion.div
            variants={fadeUp}
            className="mt-8 w-full max-w-2xl rounded-[28px] border border-border/70 bg-card/90 p-4 shadow-lg shadow-primary/10 backdrop-blur sm:p-5"
```

## Föreslagen lösning

```mermaid
flowchart TD
  currentFlow["Nu: 4 steg"] --> step1["Start"]
  currentFlow --> step2["Adresser"]
  currentFlow --> step3["Flyttdetaljer"]
  currentFlow --> step4["Bekräfta"]

  newFlow["Föreslaget: 3 steg"] --> personStart["Person och startdata"]
  newFlow --> addressStep["Adresser"]
  newFlow --> moveConfirm["Flytt och bekräfta"]

  personStart -->|
```



