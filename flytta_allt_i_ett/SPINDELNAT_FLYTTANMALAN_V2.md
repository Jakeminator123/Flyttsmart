# Spindelnat: flyttanmalan v2 (PNR som startpunkt)

Detta schema visar hur all data till slutblanketten kan samlas in med
`personnummer` som minsta gemensamma namnare, samt vilka delar som fortfarande
maste goras manuellt.

## Spindelnat (oversikt)

```mermaid
flowchart LR
  PNR[Personnummer]

  subgraph Auto[Automatiskt fran PNR]
    Lookup[Personuppslag<br/>Biluppgifter/Ratsit/Merinfo]
    Parse[Personnummer-parsing]
    Name[Namn]
    FromAddr[Nuvarande adress]
    BirthAge[Fodelsedatum + alder]
  end

  subgraph AddrAuto[Adress-harledning]
    Nominatim[Nominatim]
    PAP[PAP API]
    FromPostal[fromPostal]
    FromCity[fromCity]
    ToCity[toCity]
    ToPostal[toPostal]
  end

  subgraph Manual[Manuell inmatning]
    ToStreet[toStreet]
    MoveDate[moveDate]
    Phone[phone]
    Email[email]
    Apt[apartmentNumber]
    PropDes[propertyDesignation]
    PropOwner[propertyOwner]
  end

  subgraph Final[Slutpayload till blankett]
    SkvDate[inflyttningsdatum]
    SkvPeriod[period = Tills vidare]
    SkvStreet[gatuadress]
    SkvPostal[postnummer]
    SkvCity[postort]
    SkvApt[lagenhetsnummer]
    SkvPropDes[fastighetsbeteckning]
    SkvPropOwner[fastighetsagare]
    SkvPhone[telefonnummer]
    SkvEmail[email]
    Meta[name + personalNumber]
  end

  PNR --> Lookup
  PNR --> Parse

  Lookup --> Name
  Lookup --> FromAddr
  Parse --> BirthAge

  FromAddr --> Nominatim
  Nominatim --> FromPostal
  Nominatim --> FromCity
  FromPostal --> PAP
  PAP --> FromCity

  ToStreet --> Nominatim
  Nominatim --> ToPostal
  ToPostal --> PAP
  PAP --> ToCity

  MoveDate --> SkvDate
  ToStreet --> SkvStreet
  ToPostal --> SkvPostal
  ToCity --> SkvCity
  Apt --> SkvApt
  PropDes --> SkvPropDes
  PropOwner --> SkvPropOwner
  Phone --> SkvPhone
  Email --> SkvEmail
  Name --> Meta
  PNR --> Meta
  SkvPeriod --> Final
```

## Krav per falt

| Slutfalt | Hur det fylls | Kravstatus |
|---|---|---|
| `inflyttningsdatum` | Manuellt (`moveDate`) | Krav |
| `period` | Forvalt `true` (Tills vidare) | Krav |
| `gatuadress` | Manuellt (`toStreet`) | Krav |
| `postnummer` | Manuellt eller harlett via Nominatim/PAP | Krav |
| `postort` | Manuellt eller harlett via PAP | Krav |
| `lagenhetsnummer` | Manuellt | Villkorat |
| `fastighetsbeteckning` | Manuellt (framtid: VALID/Lantmateriet) | Valfritt |
| `fastighetsagare` | Manuellt | Valfritt |
| `telefonnummer` | Manuellt | Valfritt |
| `email` | Manuellt | Valfritt |

## Viktig slutsats

`personnummer` ar en stark startpunkt for namn + delar av nuvarande adress, men
racker inte ensam for en komplett flyttanmalan. Ny adress och flyttdatum maste
normalt anges manuellt.

