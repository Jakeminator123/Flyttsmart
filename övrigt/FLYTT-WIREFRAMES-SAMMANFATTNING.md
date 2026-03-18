# Flytt.io – Wireframe-sammanfattning

Översikt av innehållet i `flytt-wireframes.jsx` (Kalles design för flytt.io).

---

## App-struktur

| View | Beskrivning |
|------|-------------|
| `landing` | Startsida |
| `flow` | Flyttanmälan (4 steg: Form → BankID → Review → Confirm) |
| `blog` | Bloggindex |
| `article:*` | Bloggartiklar (5 st) |
| `about` | Om oss |
| `glossary` | Ordlista |
| `admin` | Admin-panel (flyttar + partners) |

---

## Kundflöde (4 steg)

### Steg 1: Formulär
- **Ny adress** – sök med autocomplete (mock: Storgatan 12, Stockholm)
- **Lägenhetsnummer** (valfritt)
- **Fastighetsbeteckning** (valfritt, t.ex. Björken 3:14)
- **Inflyttningsdatum**
- **E-post** – validering (typos: gmial, gmaill, etc.)
- **Telefon** – svenskt mobilnummer
- **Personnummer** – Luhn-validering
- **Checkbox** – godkänn användarvillkor + integritetspolicy
- **Bonus:** 3 månaders gratis hemförsäkring

### Steg 2: BankID
- Knapp: "Öppna BankID"
- Loading → Success → hämtar uppgifter
- Hämtar från SKV: personuppgifter, nuvarande adress, medboendes uppgifter

### Steg 3: Granska
- Flyttinfo: Från → Till, datum, sökande
- **Välj medflyttande:** sambo/barn (checkboxar)
- Exempel: Anna Lindgren (sambo), Liam Lindgren (barn 7 år)
- 3 månaders gratis hemförsäkring
- Knapp: "Skicka anmälan till Skatteverket"

### Steg 4: Klart
- Success-meddelande
- Hemförsäkring på ny adress från inflyttningsdatum
- **Flyttchecklista** – datumbaserad, delbar via e-post/SMS
- Grupper: Redan klart ✓, Abonnemang, Senast X, etc.
- Partnerlänkar: Bredbandsval.se, el, hemlarm, digital brevlåda

---

## Landing-sida

### Hero
- **Live ticker:** "Just nu: Flytt registrerad från [stad] till [stad]"
- **Tags:** ✓ Flyttanmälan på SKV, ✓ Helt gratis, ✓ Klart på 1 minut
- **H1:** "Flyttanmälan – som det borde funka"
- **Sub:** Gratis hemförsäkring 3 månader + smart checklista
- **CTA:** Gör flyttanmälan

### USP-kort (3 st)
1. Klart på 1 minut
2. 3 mån gratis hemförsäkring
3. Officiell & laglig anmälan

### Hur det funkar (4 steg)
1. Fyll i din nya adress
2. Logga in med mobilt BankID
3. Välj vilka som flyttar
4. Flyttanmälan klar!

### Testimonials (4 st)
- Sara L. (Göteborg → Stockholm)
- Erik T. (Uppsala → Västerås)
- Ahmed S. (Örebro → Stockholm)
- Petra & Jonas (Stockholm → Nacka)

### Om oss (teaser)
- "Vi tröttnade på att betala för saker som borde vara gratis"
- 698 kr-fakturan som startade idén

### Footer
- flytt.io, Flytt AB, Org.nr
- Länkar: Hur det funkar, Blogg, Om oss, Ordlista
- Juridiskt: Integritetspolicy, Användarvillkor, Cookies

---

## Blogg

### Index
- **Utvald:** Adressändring gratis – så gör du det rätt 2026
- **Övriga:** Flyttanmälan Skatteverket, Checklista försäljning, Adressändra vid flytt, Eftersändning vs folkbokföring

### Artiklar (5 st)
| Slug | Titel |
|------|-------|
| adressandring-gratis | Adressändring gratis – så gör du det rätt 2026 |
| flyttanmalan-skatteverket | Flyttanmälan till Skatteverket – allt du behöver veta |
| checklista-forsaljning | Checklista inför försäljning och flytt |
| adressandra-vid-flytt | Adressändra vid flytt – vem behöver du meddela? |
| eftersandning-eller-folkbokforing | Eftersändning vs folkbokföring – vad är skillnaden? |

---

## Om oss
- Statistik: 47 000+ användare, 58 sek genomsnitt, 96% nöjda, 0 kr kostnad
- CTA: "Redo att flytta rätt?"

---

## Admin-panel

### Flyttar
- Lista: ID, datum, namn, från, till, status (Klar/Pending/Error)
- Sök, filter
- Detaljvy: personuppgifter, medflyttande, partneraktiviteter, lead-status

### Partners
- Bredbandsval.se, Vattenfall, Trygg-Hansa, Verisure, Billo, Kivra, Fortum
- Kategorier: Bredband & TV, El, Hemförsäkring, Hemlarm, Digital brevlåda, etc.
- Lägg till partner: namn, bransch, e-post för leads

---

## Design

| Element | Värde |
|---------|-------|
| **Typsnitt** | DM Sans (body), Playfair Display (rubriker) |
| **Accent** | #7EE8A2 (mintgrön) |
| **Text** | #1A1A2E (mörk) |
| **Bakgrund** | #fff, gradient hero |
| **BankID-färg** | #235971 |

---

## Övrigt

- **Språk:** Svenska + Engelska (LangPicker)
- **Chatbot:** Claude API (Anthropic), flytt.io-specifik system prompt
- **Dev-navigering:** Fast bottenrad för att hoppa mellan vyer
- **SEO:** Meta, JSON-LD, canonical, og:*

---

## Så kan du visa wireframe visuellt

Filen är React/JSX. För att köra den:

1. **Vite:** Skapa ett nytt Vite + React-projekt, kopiera in filen som `App.jsx`, kör `npm run dev`
2. **Integrera i flytta_nu:** Lägg till en route t.ex. `/wireframe` som importerar och renderar komponenten (kräver lite anpassning för Next.js)

Vill du ha ett minimalt Vite-setup i `övrigt/` för att bara köra wireframe-filen?
