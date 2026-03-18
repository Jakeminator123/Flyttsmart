# GDPR-handlingsguide for Flytt.io

Senast uppdaterad: 2026-02-25

## 1. Oversikt: rattsliga grunder som anvands

| Rattslig grund | Anvandning i Flytt.io | GDPR-artikel |
|---|---|---|
| Avtal | Tillhandahalla tjansten: formulardatahantering, checklistor, flyttanmalan | Art. 6(1)(b) |
| Samtycke | Marknadsforingsutskick via e-post/SMS, delning med partners | Art. 6(1)(a) |
| Berattigat intresse | Visa relevanta erbjudanden i inloggat lage, forbattra tjansten, grundlaggande analytics | Art. 6(1)(f) |
| Rattslig forpliktelse | Lagkrav (t.ex. bokforing om betalfloden inforlivs) | Art. 6(1)(c) |

## 2. Vad far ni gora utan samtycke (avtal / berattigat intresse)

### Under AVTAL (Art. 6(1)(b))
- Samla in uppgifter som kravs for att genomfora flyttanmalan: namn, personnummer, adresser, flyttdatum, kontaktuppgifter.
- Slå upp ort fran postnummer (PAP API) for att hjalpa anvandaren fylla i formularet korrekt.
- Validera adresser via Nominatim/OpenStreetMap.
- Generera personlig, datumsatt checklista baserad pa flyttdatum.
- Spara flyttdata i databasen (Turso) sa lange kontot ar aktivt.
- Skicka paminnelser om kommande checklistmoment via e-post (transaktionell kommunikation som ar del av tjansten).

### Under BERATTIGAT INTRESSE (Art. 6(1)(f))
- Visa erbjudanden (el, bredband, forsakring) i inloggat lage, baserat pa flyttdata.
- Anvanda Eniro foretagssok for lokala tjanstetips (matbutiker, vardcentral, apotek).
- Hamta befolkningsdata fran SCB for kontextuell information.
- Grundlaggande analytics (Vercel Analytics) for tjansteforbatrring.
- IP-baserad grov geopositionering (se sektion 4).

### Krav for berattigat intresse
- Genomfor och dokumentera en **intresseavvagning** (Legitimate Interest Assessment, LIA).
- Anvandaren maste informeras via integritetspolicyn.
- Anvandaren har ratt att **invanda** (Art. 21) — implementera en opt-out-mekanism.

## 3. Vad KRAVER samtycke

| Aktivitet | Typ av samtycke | Implementering |
|---|---|---|
| Marknadsforingsmail/SMS | Opt-in (fore utskick) | Checkbox vid registrering, avregistrera-lank i varje mail |
| Dela persondata med namngivna partners | Explicit opt-in | "Ja, dela med [Partner X]" per erbjudande |
| Marknadsforingscookies / tredjepartstracking | Cookie-samtycke | Cookie-banner med granulara val |
| Profilbaserad annonsering | Explicit opt-in | Separerat fran tjanstesamtycke |

### Krav pa samtycke (Art. 7)
- Fritt, specifikt, informerat och otvetydigt.
- Maste ga att aterkalla lika enkelt som det gavs.
- Bevisborda pa att samtycke inhemtats ligger pa Flytt.io.
- Samtycke far INTE vara villkorat for att anvanda grundtjansten.

## 4. IP-adress och geopositionering

### Laglig anvandning (utan specifikt samtycke)
- **Sakerhetsandamal**: skydda mot bedrageri, rate limiting, DDoS-skydd. Rattslig grund: berattigat intresse.
- **Grov geopositionering (stad/region)**: styra sprak/valuta, visa relevant innehall. Rattslig grund: berattigat intresse, om proportionerligt.

### Begransningar
- IP-geolocation ger typiskt stad/region med 50-80% traffsaker — det ar **inte** en hemadress.
- Anvand IP-geodata for **UX-anpassning**, inte for personidentifiering eller profilering.
- For positionsbaserade erbjudanden (t.ex. bredband pa adress): anvand istallet den adress anvandaren sjalv matat in.

### Retention och transparens
- **Trunkera** eller pseudonymisera IP-adresser sa snart mojligt (t.ex. ta bort sista oktetten).
- Lagra inte full IP langre an **7-30 dagar** for loggning/sakerhet.
- I aggregerade analysdata: anonymisera helt.
- **Dokumentera** IP-hanteringen i integritetspolicyn (redan omnamt i nuvarande policy).
- Om ni anvander tredjepartstjanst for IP-lookup (t.ex. elomraden.se): inga personuppgiftsbitrades-avtal (DPA) kravs om ni bara skickar IP (som anvandaren redan exponerar vid besok), men verifiera att tjansten inte sparar/profilerar.

### Vad bor undvikas
- Koppla IP-adress till personnummer/flyttdata for att bygga personprofil.
- Anvanda IP for retargeting eller kors-sajt-sparing utan cookie-samtycke.
- Spara exakt GPS/koordinater fran IP utan tydlig grund och kort retention.

## 5. Tredjepartskallor och personuppgiftsbitraden

| Tjanst | Roll | Krav |
|---|---|---|
| PAP API (papapi.se) | Postnummeruppslag (ingen persondata) | Inget DPA kravs |
| Nominatim (OpenStreetMap) | Adressvalidering (ingen persondata) | Inget DPA kravs |
| Eniro Company Search | Foretagslistor (ingen persondata) | Inget DPA kravs |
| SCB API v2 | Befolkningsstatistik (aggregerad data) | Inget DPA kravs |
| D-ID (avatar) | Bearbetar rost/video i realtid | DPA rekommenderas — kontrollera D-IDs villkor |
| OpenClaw/Render | LLM-brain for Aida (tar emot formularkontext) | DPA kravs — personuppgifter passerar |
| Vercel (hosting) | Server-side rendering, API-routes | DPA ingår i Vercels standardvillkor |
| Turso (databas) | Lagrar flyttdata, checklistor, anvandare | DPA kravs — karndata |
| Resend / SendGrid (e-post) | Paminnelsemail med namn + checklistdata | DPA kravs |
| BankID | Identifiering (personnummer, namn) | Avtal med BankID-leverantor |
| SPAR (vid framtida anslutning) | Folkbokforingsdata | Ansokan + tillstand + DPA |
| PersonKontakt/Marknadsinformation (vid framtida avtal) | Telefon -> persondata via SPAR | DPA + redovisad andamal |

## 6. Dataminimering — praktisk checklista

- [ ] Logga inte personnummer i klartext i server-loggar.
- [ ] Kryptera personnummer i databasen (at-rest encryption).
- [ ] Begränsa antalet falt som skickas till LLM/OpenClaw: undvik att skicka personnummer i system-prompten om det inte ar nodvandigt for svaret.
- [ ] Rensa sessiondata (in-memory session-store) efter 30 min inaktivitet (redan implementerat).
- [ ] Satt retention pa Turso-data: radera eller anonymisera flyttdata 12 manader efter flytten.
- [ ] IP-adresser i Vercel-loggar: kontrollera retention-policy (Vercel rensar automatiskt efter 30 dagar pa Pro-plan).
- [ ] Granska att `.env`-hemligheter inte hamnar i git-historik.

## 7. DPIA och ROPA

### Nar kravs en DPIA (Data Protection Impact Assessment)?
En DPIA ar troligen **inte** lagligt pavkallad i tidigt skede, men rekommenderas nar:
- Ni borjar behandla personnummer i stor skala.
- Ni kopplar ihop BankID-identitet med flyttdata och partner-erbjudanden.
- Ni ansluter till SPAR eller PersonKontakt.

### ROPA (Register of Processing Activities, Art. 30)
Skapa ett behandlingsregister med:
- Andamal, rattslig grund, kategorier av registrerade och uppgifter.
- Mottagare (partners, personuppgiftsbitraden).
- Lagringstid och overforingar till tredjeland.
- Tekniska och organisatoriska skyddsatgarder.

## 8. Anvandarnara rattigheter — implementeringsstatus

| Rattighet | Status | Implementering |
|---|---|---|
| Tillgang (Art. 15) | **Planerad** | Dashboard: exportera "min data" |
| Rattelse (Art. 16) | **Delvis** | Formularfalt kan andras innan submit |
| Radering (Art. 17) | **Planerad** | "Radera konto"-knapp pa dashboard |
| Dataportabilitet (Art. 20) | **Planerad** | JSON-export av flyttdata + checklista |
| Invandning (Art. 21) | **Delvis** | Avregistrera-lank i mail; behover opt-out for in-app-erbjudanden |
| Aterkalla samtycke | **Delvis** | Avregistrera-lank; behover UI-stod i kontoinstellningar |

## 9. Sammanfattning — vad ni far gora nu

| Ja (lagligt nu) | Krav | Nej / undvik |
|---|---|---|
| Samla flyttuppgifter for att genomfora tjansten | Avtal + policy | Logga personnummer i klartext |
| Slå upp ort fran postnummer | Avtal | Spar full IP langre an 30 dagar |
| Visa erbjudanden i inloggat lage | Berattigat intresse + LIA | Dela persondata med partner utan opt-in |
| Skicka tjanstemail/paminnelser | Avtal (del av tjanst) | Skicka marknadsforingsmail utan samtycke |
| Grundlaggande analytics | Berattigat intresse | Kors-sajt-tracking utan cookie-samtycke |
| Grov IP-geo for UX-anpassning | Berattigat intresse | Bygga personprofil fran IP |
| Hamta SCB-statistik, Eniro-foretag | Oppen data, inget DPA | Anvanda SPAR/PersonKontakt utan tillstand |

## Relaterade filer

- Integritetspolicy (live): `app/integritetspolicy/page.tsx`
- Cookiepolicy (live): `app/cookiepolicy/page.tsx`
- Samlad kunskap (juridisk analys): `info/flytta_nu_samlad_kunskap.txt` (DEL 4)
- Session-store (retention): `lib/did/session-store.ts`
- Enrichment (API-anrop): `lib/aida/enrich.ts`
