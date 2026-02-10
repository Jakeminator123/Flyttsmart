import type { Metadata } from "next"
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout"

export const metadata: Metadata = {
  title: "Allmänna villkor – Flytt.io",
  description: "Allmänna villkor för användning av tjänsten Flytt.io.",
}

export default function VillkorPage() {
  return (
    <LegalPageLayout badge="Juridiskt" title="Allmänna villkor för Flytt.io">
      <p>
        Dessa allmänna villkor (&quot;Villkoren&quot;) gäller för användning av tjänsten Flytt.io (&quot;Tjänsten&quot;), som tillhandahålls av Flytt.io (&quot;vi&quot;, &quot;oss&quot;).
        Genom att registrera dig, logga in med BankID eller på annat sätt använda Tjänsten accepterar du dessa Villkor.
      </p>

      <LegalSection heading="1. Om Flytt.io">
        <p>Flytt.io är en kostnadsfri, digital tjänst som hjälper privatpersoner att planera och genomföra en flytt. Tjänsten kan bland annat omfatta:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Hjälp med flyttanmälan till Skatteverket</li>
          <li>Adressrelaterade påminnelser och checklistor</li>
          <li>Samlad överblick över flyttrelaterade moment</li>
          <li>Presentation av relevanta erbjudanden från samarbetspartners</li>
        </ul>
        <p>Flytt.io är inte en myndighet och ersätter inte Skatteverket, Svensk Adressändring eller andra offentliga aktörer, utan fungerar som ett hjälpmedel.</p>
      </LegalSection>

      <LegalSection heading="2. Användarkonto och identifiering">
        <p>För att använda Tjänsten krävs identifiering med Mobilt BankID. Vid inloggning skapas ett personligt konto kopplat till ditt personnummer. Kontot används för att:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Säkerställa korrekt identifiering</li>
          <li>Anpassa innehåll och checklistor</li>
          <li>Tillhandahålla relevanta erbjudanden</li>
        </ul>
        <p>Du ansvarar för att de uppgifter du bekräftar eller kompletterar är korrekta.</p>
      </LegalSection>

      <LegalSection heading="3. Tjänstens kostnad">
        <p>Tjänsten är kostnadsfri för användaren. Flytt.io finansieras helt eller delvis genom samarbeten med externa partners som kan erbjuda produkter eller tjänster i samband med flytt.</p>
      </LegalSection>

      <LegalSection heading="4. Erbjudanden och marknadsföring">
        <p><strong>4.1 Rätt att visa och skicka erbjudanden</strong></p>
        <p>Genom att använda Tjänsten samtycker du till att Flytt.io får visa personligt anpassade erbjudanden i inloggat läge samt skicka erbjudanden, påminnelser och information via e-post och/eller SMS.</p>
        <p>Erbjudandena kan avse exempelvis elavtal, bredband och TV, försäkringar, hemlarm, flyttfirma, flyttstädning, magasinering, matkassar och andra hushållsnära tjänster.</p>
        <p><strong>4.2 Anpassning och relevans</strong></p>
        <p>Erbjudanden baseras på uppgifter kopplade till din flytt, såsom flyttdatum, nuvarande och ny adress, bostadstyp och storlek, samt antal personer i hushållet.</p>
        <p><strong>4.3 Frivillighet</strong></p>
        <p>Alla erbjudanden är frivilliga. Du är aldrig skyldig att tacka ja till ett erbjudande för att använda Tjänsten.</p>
      </LegalSection>

      <LegalSection heading="5. Kommunikation">
        <p>Flytt.io kan komma att kontakta dig via e-post, SMS eller notiser i inloggat läge. Kommunikationen kan avse påminnelser kopplade till din flytt, statusuppdateringar, erbjudanden eller viktig information om Tjänsten.</p>
        <p>Du kan när som helst välja att avregistrera dig från marknadsföringsutskick via länk i e-post eller genom inställningar i kontot.</p>
      </LegalSection>

      <LegalSection heading="6. Personuppgifter och integritet">
        <p>Flytt.io behandlar personuppgifter i enlighet med gällande dataskyddslagstiftning (GDPR). Mer information om hur vi behandlar personuppgifter finns i vår Integritetspolicy.</p>
      </LegalSection>

      <LegalSection heading="7. Ansvarsbegränsning">
        <p>Flytt.io strävar efter att information och påminnelser ska vara korrekta och uppdaterade, men kan inte garantera att alla moment i en flytt täcks eller att information alltid är fullständig. Flytt.io ansvarar inte för:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Eventuella fel eller förseningar hos myndigheter eller samarbetspartners</li>
          <li>Avtal som användaren ingår med tredje part</li>
          <li>Skador, kostnader eller förluster som uppstår till följd av användning av externa tjänster</li>
        </ul>
      </LegalSection>

      <LegalSection heading="8. Ändringar av villkoren">
        <p>Flytt.io förbehåller sig rätten att ändra dessa Villkor. Vid väsentliga ändringar informeras användaren via e-post eller i Tjänsten. De uppdaterade Villkoren gäller från och med den dag de publiceras på flytt.io.</p>
      </LegalSection>

      <LegalSection heading="9. Avslut av konto">
        <p>Du kan när som helst avsluta ditt konto genom att kontakta Flytt.io. Flytt.io förbehåller sig rätten att avsluta konton vid missbruk av Tjänsten eller brott mot Villkoren.</p>
      </LegalSection>

      <LegalSection heading="10. Tillämplig lag och tvist">
        <p>Villkoren regleras av svensk lag. Tvist som uppstår i anledning av Villkoren ska i första hand lösas genom dialog. Om tvist inte kan lösas ska den avgöras av svensk allmän domstol.</p>
      </LegalSection>

      <LegalSection heading="11. Kontakt">
        <p>Flytt.io<br />E-post: info@flytt.io</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
