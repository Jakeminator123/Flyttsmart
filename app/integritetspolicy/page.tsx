import type { Metadata } from "next"
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout"

export const metadata: Metadata = {
  title: "Integritetspolicy – Flytt.io",
  description: "Integritetspolicy för Flytt.io – så hanterar vi dina personuppgifter.",
}

export default function IntegritetspolicyPage() {
  return (
    <LegalPageLayout badge="Integritet" title="Integritetspolicy för Flytt.io">
      <p>
        Din integritet är viktig för oss. I denna integritetspolicy förklarar vi hur Flytt.io behandlar personuppgifter när du använder vår tjänst.
      </p>

      <LegalSection heading="1. Personuppgiftsansvarig">
        <p>Personuppgiftsansvarig för behandlingen av dina personuppgifter är Flytt.io.</p>
        <p>E-post: info@flytt.io</p>
      </LegalSection>

      <LegalSection heading="2. Vilka personuppgifter vi behandlar">
        <p><strong>2.1 Uppgifter du själv lämnar</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>E-postadress</li>
          <li>Mobilnummer</li>
          <li>Uppgifter kopplade till din flytt (t.ex. flyttdatum, ny adress)</li>
        </ul>
        <p><strong>2.2 Uppgifter vi hämtar automatiskt</strong></p>
        <p>Vid inloggning med BankID och användning av Tjänsten kan vi hämta eller ta emot personnummer, namn och folkbokföringsadress. Uppgifter kan även kompletteras från externa register.</p>
        <p><strong>2.3 Tekniska uppgifter</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>IP-adress</li>
          <li>Enhetsinformation</li>
          <li>Loggar kopplade till användning av Tjänsten</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Varför vi behandlar personuppgifter">
        <p>Vi behandlar personuppgifter för att:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Tillhandahålla och administrera Tjänsten</li>
          <li>Identifiera dig på ett säkert sätt</li>
          <li>Skapa personliga checklistor och påminnelser</li>
          <li>Möjliggöra flyttrelaterade funktioner, såsom flyttanmälan</li>
          <li>Visa och skicka relevanta erbjudanden kopplade till din flytt</li>
          <li>Förbättra och utveckla Tjänsten</li>
          <li>Uppfylla rättsliga skyldigheter</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Rättslig grund för behandlingen">
        <p>Vi behandlar personuppgifter med stöd av följande rättsliga grunder:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Avtal</strong> – för att kunna tillhandahålla Tjänsten enligt Användarvillkoren</li>
          <li><strong>Samtycke</strong> – för utskick av marknadsföring via e-post och SMS</li>
          <li><strong>Berättigat intresse</strong> – för att visa relevanta erbjudanden i inloggat läge samt förbättra Tjänsten</li>
          <li><strong>Rättslig förpliktelse</strong> – när lag kräver behandling</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Erbjudanden och marknadsföring">
        <p>Flytt.io kan visa och kommunicera erbjudanden från oss själva eller från samarbetspartners. Erbjudanden anpassas utifrån uppgifter om din flytt, såsom bostadstyp, flyttdatum och geografiskt område.</p>
        <p>Du kan när som helst välja att tacka nej till marknadsföringsutskick via länk i e-post, SMS eller via inställningar i ditt konto.</p>
      </LegalSection>

      <LegalSection heading="6. Delning av personuppgifter">
        <p>Vi delar endast personuppgifter när det är nödvändigt:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Med tekniska leverantörer som tillhandahåller drift, kommunikation och säker inloggning</li>
          <li>Med samarbetspartners, om du aktivt visar intresse för ett erbjudande eller lämnar samtycke</li>
          <li>Med myndigheter, när det krävs enligt lag</li>
        </ul>
        <p>Vi säljer aldrig personuppgifter.</p>
      </LegalSection>

      <LegalSection heading="7. Lagringstid">
        <p>Vi sparar personuppgifter så länge som du har ett aktivt konto hos Flytt.io, det krävs för de ändamål som anges i denna policy, eller vi är skyldiga enligt lag. När uppgifterna inte längre behövs raderas eller anonymiseras de.</p>
      </LegalSection>

      <LegalSection heading="8. Dina rättigheter">
        <p>Du har rätt att:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Begära tillgång till dina personuppgifter</li>
          <li>Begära rättelse av felaktiga uppgifter</li>
          <li>Begära radering (&quot;rätten att bli glömd&quot;)</li>
          <li>Invända mot viss behandling</li>
          <li>Begära begränsning av behandling</li>
          <li>Återkalla samtycke</li>
          <li>Lämna klagomål till Integritetsskyddsmyndigheten (IMY)</li>
        </ul>
        <p>Kontakta oss på info@flytt.io för att utöva dina rättigheter.</p>
      </LegalSection>

      <LegalSection heading="9. Säkerhet">
        <p>Vi vidtar tekniska och organisatoriska åtgärder för att skydda dina personuppgifter, bland annat genom kryptering, behörighetsstyrning och säker inloggning med BankID.</p>
      </LegalSection>

      <LegalSection heading="10. Ändringar av integritetspolicyn">
        <p>Vi kan komma att uppdatera denna integritetspolicy. Den senaste versionen finns alltid tillgänglig på flytt.io. Vid väsentliga ändringar informerar vi via e-post eller i Tjänsten.</p>
      </LegalSection>

      <LegalSection heading="11. Kontakt">
        <p>Flytt.io<br />E-post: info@flytt.io</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
