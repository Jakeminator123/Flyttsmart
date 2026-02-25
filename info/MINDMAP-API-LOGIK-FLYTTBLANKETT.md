# Mindmap: API-logik och faltharledning for Skatteverkets flyttblankett

Senast uppdaterad: 2026-02-25

## 1. Oversikt — fran anvandare till Skatteverket

```mermaid
flowchart TD
  subgraph userProvided [Anvandaren matar in]
    pnr[Personnummer]
    moveDate[Inflyttningsdatum]
    street[Gatuadress]
    postal[Postnummer]
    aptNr[Lagenhetsnummer]
    propOwner[Fastighetsagare]
    phone[Telefonnummer]
    email[E-post]
  end

  subgraph autoFromBankID [BankID / Skatteverket visar]
    curName[Namn]
    curAddress[Nuvarande folkbokforingsadress]
    curPnr[Personnummer]
  end

  subgraph apiDerived [Harledda via API]
    city[Postort]
    propDesig[Fastighetsbeteckning]
    geoData[Koordinater / stadsdel]
    munData[Kommun / lan]
    popData[Befolkningsdata]
    localServices[Lokala tjanster]
    moveDateInsights[Tidsanalys]
  end

  subgraph skvForm [Skatteverkets 10 falt]
    skvDate[inflyttningsdatum]
    skvPeriod[period]
    skvStreet[gatuadress]
    skvPostal[postnummer]
    skvCity[postort]
    skvApt[lagenhetsnummer]
    skvPropDesig[fastighetsbeteckning]
    skvPropOwner[fastighetsagare]
    skvPhone[telefonnummer]
    skvEmail[email]
  end

  postal -->|PAP API| city
  street -->|Nominatim| geoData
  postal -->|PAP API| munData
  street -->|VALID API framtid| propDesig
  city -->|SCB v2| popData
  city -->|Eniro| localServices
  moveDate --> moveDateInsights

  moveDate --> skvDate
  street --> skvStreet
  postal --> skvPostal
  city --> skvCity
  aptNr --> skvApt
  propDesig --> skvPropDesig
  propOwner --> skvPropOwner
  phone --> skvPhone
  email --> skvEmail
```

## 2. Minsta gemensamma namnare — vad anvandaren MASTE ge

Oavsett vilka API:er som finns maste anvandaren sjalv uppge:

| Uppgift | Varfor den inte kan harledas | Skatteverksfalt |
|---|---|---|
| Inflyttningsdatum | Personlig beslutsinformation | `inflyttningsdatum` |
| Gatuadress (ny) | Specifik bostadsadress | `gatuadress` |
| Postnummer (ny) | Ingen saker omvand harledning fran ort/gata | `postnummer` |
| Lagenhetsnummer | Specifikt per dorr, inte tillgangligt i oppen data | `lagenhetsnummer` |
| Fastighetsagare | Kan vara privatperson, BRF eller foretag | `fastighetsagare` |
| Telefonnummer | Kontaktuppgift | `telefonnummer` |
| E-post | Kontaktuppgift | `email` |

**Total: 7 uppgifter fran anvandaren.**

## 3. Vad som kan harledas automatiskt

| Harlett falt | Kalla | Indata | Konfidens | Status |
|---|---|---|---|---|
| Postort | PAP API | postnummer (5 siffror) | 98-99% | AKTIV |
| Kommun, lan | PAP API | postnummer | 95-98% | AKTIV |
| GPS-koordinater | Nominatim | gata + ort + postnummer | 97-99% | AKTIV |
| Stadsdel | Nominatim | gata + ort | 85-95% | AKTIV |
| Befolkningsdata | SCB v2 | kommunkod | 99% (statistik) | AKTIV |
| Lokala tjanster | Eniro Company | ort + sokterm | 90-95% (relevans) | AKTIV |
| Fastighetsbeteckning | VALID API / Lantmateriet | gata + postnummer + ort | 95%+ | FRAMTID |
| Tidsanalys (dagar kvar, prio) | Lokal berakning | inflyttningsdatum | 100% | AKTIV |

## 4. Faltrelationer — mermaid mindmap

```mermaid
mindmap
  root((Flyttblanketten))
    Anvandaren ger
      Personnummer
        BankID validering
        Alder via parsing
      Inflyttningsdatum
        Tidsanalys
        Checklistdatum
      Ny adress
        Gatuadress
          Nominatim validering
          VALID fastighetsbeteckning framtid
        Postnummer
          PAP ort
          PAP kommun lan
        Lagenhetsnummer
      Fastighetsagare
        Eniro foretag om foretag
      Kontakt
        Telefon
        E-post
    BankID ger
      Namn
      Nuvarande adress
      Personnummer bekraftat
    API-lager berikar
      PAP
        Postort 98 procent
        Kommun lan GPS
      Nominatim
        Adressvalidering
        Koordinater
        Stadsdel
      Eniro
        Lokala foretag
        Matbutik vardcentral apotek
      SCB v2
        Befolkning per kommun
        Folkokning
      Elpris API framtid
        Timpris per elomrade
        Elomrade fran postnummer
      Trafiklab framtid
        Pendling hallplatser
      PTS framtid
        Bredbandstillgang per adress
```

## 5. Konfidensniva per datalager

```mermaid
flowchart LR
  subgraph high [97 procent plus konfidens]
    ortFromPostal[Ort fran postnummer]
    addrValidation[Adressrimlighet]
    scbStats[SCB statistik]
    timeCalc[Tidsberakning]
  end

  subgraph medium [80 till 95 procent konfidens]
    localServices2[Eniro foretagssok]
    geoSuburb[Stadsdel via Nominatim]
    propDesig2[Fastighetsbeteckning via VALID]
  end

  subgraph low [Under 70 procent konfidens]
    personMatch[Personidentifiering utan auktoritativ kalla]
    ipGeo[IP-geopositionering]
  end

  subgraph authoritative [97 procent plus med tillstand]
    spar[SPAR folkbokforing]
    personKontakt[PersonKontakt telefon till person]
  end
```

## 6. Faltmatris — Skatteverkets falt vs datakallor

| SKV-falt | Kravs | Primar kalla | Sekundar kalla | Konfidens |
|---|---|---|---|---|
| `inflyttningsdatum` | Ja | Anvandaren | — | 100% (manuell) |
| `period` | Ja | Forvalt "Tills vidare" | — | 100% |
| `gatuadress` | Ja | Anvandaren | Nominatim autocomplete | 100% (manuell) |
| `postnummer` | Ja | Anvandaren | — | 100% (manuell) |
| `postort` | Ja | PAP API | Fallback-tabell | 98-99% |
| `lagenhetsnummer` | Nej* | Anvandaren | Hyreskontrakt | 100% (manuell) |
| `fastighetsbeteckning` | Nej | Anvandaren | VALID API (framtid) | 95%+ (API) |
| `fastighetsagare` | Nej | Anvandaren | Eniro Company | 80-90% (om foretag) |
| `telefonnummer` | Nej | Anvandaren | — | 100% (manuell) |
| `email` | Nej | Anvandaren | — | 100% (manuell) |

*Kravs om fastigheten har lagenhetsnummer.

## 7. Harledningskedja for maximal autofyll

```
Anvandaren skriver: postnummer + gatuadress
  -> PAP API:      postnummer -> postort, kommun, lan  (AKTIV)
  -> Nominatim:    gata + ort -> validerad adress, koordinater, stadsdel  (AKTIV)
  -> VALID API:    gata + postnr + ort -> fastighetsbeteckning  (FRAMTID)
  -> Eniro:        ort -> lokala matbutiker, vardcentral, apotek  (AKTIV)
  -> SCB v2:       kommunkod -> befolkning, folkokning  (AKTIV)
  -> Elpris API:   postnummer -> elomrade -> timpris  (FRAMTID)
  -> Trafiklab:    koordinater -> narmaste hallplats, pendlingstid  (FRAMTID)
  -> PTS:          adress/omrade -> bredbandstillgang  (FRAMTID)

Resultat: 3 av 10 SKV-falt auto-ifyllda, 5+ extra kontextfalt for Aida.
Med VALID API: 4 av 10 SKV-falt.
```

## Relaterade filer

- Enrichment-logik: `lib/aida/enrich.ts`
- Autofill fallback: `lib/aida/direct-suggestion.ts`
- Faltkunskap i systemprompt: `lib/aida/enrich.ts` (`FIELD_KNOWLEDGE` export)
- Postaluppslag: `app/api/enrich/postal/route.ts`
- Samlad kunskap (DEL 2 + 3): `info/flytta_nu_samlad_kunskap.txt`
