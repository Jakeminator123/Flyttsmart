import type { Metadata } from "next"
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout"

export const metadata: Metadata = {
  title: "Cookiepolicy – Flytt.io",
  description: "Cookiepolicy för Flytt.io – hur vi använder cookies.",
}

export default function CookiepolicyPage() {
  return (
    <LegalPageLayout badge="Cookies" title="Cookiepolicy för Flytt.io">
      <p>
        Denna cookiepolicy beskriver hur Flytt.io använder cookies och liknande tekniker på webbplatsen flytt.io.
        Genom att använda webbplatsen samtycker du till vår användning av cookies i enlighet med denna policy, i den mån samtycke krävs enligt lag.
      </p>

      <LegalSection heading="1. Vad är cookies?">
        <p>Cookies är små textfiler som lagras på din enhet (dator, mobil eller surfplatta) när du besöker en webbplats. Cookies används för att webbplatsen ska fungera korrekt, förbättra användarupplevelsen och i vissa fall för marknadsföring.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Sessionscookies</strong> – raderas när du stänger webbläsaren</li>
          <li><strong>Beständiga cookies</strong> – sparas under en viss tid eller tills du själv tar bort dem</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Varför vi använder cookies">
        <p><strong>2.1 Nödvändiga cookies</strong></p>
        <p>Dessa cookies är nödvändiga för att webbplatsen ska fungera korrekt och kan inte väljas bort. De används till exempel för att möjliggöra säker inloggning med BankID, komma ihåg dina inställningar och säkerställa teknisk funktionalitet.</p>

        <p><strong>2.2 Funktionella cookies</strong></p>
        <p>Dessa cookies används för att förbättra din upplevelse av webbplatsen, till exempel genom att spara val du gör i Tjänsten och anpassa innehåll efter din flytt.</p>

        <p><strong>2.3 Analyscookies</strong></p>
        <p>Vi använder analyscookies för att förstå hur webbplatsen används – vilka sidor som besöks och hur användare navigerar. Uppgifterna används på aggregerad nivå.</p>

        <p><strong>2.4 Marknadsföringscookies</strong></p>
        <p>Marknadsföringscookies kan användas för att visa relevanta erbjudanden och mäta effekten av marknadsföring. Dessa används endast i den utsträckning det är tillåtet enligt lag och, när så krävs, efter ditt samtycke.</p>
      </LegalSection>

      <LegalSection heading="3. Tredjepartscookies">
        <p>Flytt.io kan använda cookies från tredjepartsleverantörer, till exempel för analys eller kommunikation. Dessa leverantörer behandlar information i enlighet med sina egna integritetspolicys.</p>
      </LegalSection>

      <LegalSection heading="4. Samtycke och val">
        <p>När du besöker webbplatsen första gången får du möjlighet att acceptera alla cookies, avvisa icke-nödvändiga cookies eller göra egna val. Du kan när som helst ändra eller återkalla ditt samtycke via cookieinställningar på webbplatsen.</p>
      </LegalSection>

      <LegalSection heading="5. Hantera cookies i din webbläsare">
        <p>Du kan även själv hantera eller ta bort cookies via inställningarna i din webbläsare. Observera att vissa delar av webbplatsen då kan sluta fungera korrekt.</p>
      </LegalSection>

      <LegalSection heading="6. Ändringar av cookiepolicyn">
        <p>Vi kan komma att uppdatera denna cookiepolicy. Den senaste versionen finns alltid tillgänglig på flytt.io. Vid väsentliga ändringar informerar vi på webbplatsen.</p>
      </LegalSection>

      <LegalSection heading="7. Kontakt">
        <p>Flytt.io<br />E-post: info@flytt.io</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
