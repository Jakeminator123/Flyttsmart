import type { Metadata } from "next"
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout"

export const metadata: Metadata = {
  title: "Användarvillkor – Flytt.io",
  description: "Användarvillkor för tjänsten Flytt.io.",
}

export default function AnvandarvillkorPage() {
  return (
    <LegalPageLayout badge="Juridiskt" title="Användarvillkor för Flytt.io">
      <p>
        Dessa användarvillkor (&quot;Användarvillkoren&quot;) gäller när du använder tjänsten Flytt.io (&quot;Tjänsten&quot;).
        Genom att logga in med BankID eller på annat sätt använda Tjänsten godkänner du dessa Användarvillkor.
      </p>

      <LegalSection heading="1. Vad är Flytt.io?">
        <p>Flytt.io är en kostnadsfri, digital tjänst som hjälper privatpersoner i Sverige att planera och genomföra en flytt. Tjänsten kan bland annat omfatta:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Hjälp med flyttanmälan till Skatteverket</li>
          <li>Personliga checklistor och påminnelser kopplade till flytt</li>
          <li>Samlad information om flyttrelaterade moment</li>
          <li>Visning av relevanta erbjudanden från samarbetspartners</li>
        </ul>
        <p>Flytt.io är en privat tjänst och är inte en myndighet. Vi ersätter inte Skatteverket, Svensk Adressändring eller andra offentliga aktörer.</p>
      </LegalSection>

      <LegalSection heading="2. Vem kan använda Tjänsten?">
        <p>För att använda Flytt.io måste du:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Vara minst 18 år</li>
          <li>Vara folkbokförd i Sverige</li>
          <li>Kunna identifiera dig med Mobilt BankID</li>
        </ul>
        <p>Tjänsten är avsedd för privat bruk.</p>
      </LegalSection>

      <LegalSection heading="3. Inloggning och konto">
        <p>Inloggning sker med Mobilt BankID. Vid första inloggning skapas ett personligt konto kopplat till ditt personnummer. Du ansvarar för att de uppgifter du bekräftar eller lämnar i Tjänsten är korrekta och aktuella.</p>
      </LegalSection>

      <LegalSection heading="4. Kostnad">
        <p>Flytt.io är helt gratis för dig som användare. Tjänsten finansieras genom samarbeten med externa partners som kan erbjuda produkter och tjänster i samband med flytt.</p>
      </LegalSection>

      <LegalSection heading="5. Erbjudanden och kommunikation">
        <p><strong>5.1 Erbjudanden</strong></p>
        <p>När du använder Flytt.io samtycker du till att vi får visa och kommunicera relevanta erbjudanden kopplade till din flytt. Erbjudanden kan visas i inloggat läge, via e-post eller via SMS.</p>
        <p>Erbjudandena kan avse till exempel el, bredband, försäkring, flyttfirma, flyttstädning, larm eller andra boenderelaterade tjänster. Alla erbjudanden är frivilliga. Du väljer själv om du vill ta del av dem.</p>
        <p><strong>5.2 Avregistrering</strong></p>
        <p>Du kan när som helst välja att tacka nej till marknadsföringsutskick via länk i e-post, genom SMS-instruktioner eller via inställningar i ditt konto.</p>
      </LegalSection>

      <LegalSection heading="6. Personuppgifter">
        <p>Flytt.io behandlar personuppgifter i enlighet med gällande dataskyddslagstiftning (GDPR). Mer information finns i vår Integritetspolicy.</p>
      </LegalSection>

      <LegalSection heading="7. Ansvar och begränsningar">
        <p>Flytt.io strävar efter att Tjänsten ska vara korrekt och tillgänglig, men kan inte garantera att all information är fullständig eller felfri. Flytt.io ansvarar inte för:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Beslut du fattar baserat på information i Tjänsten</li>
          <li>Tjänster eller avtal som tillhandahålls av tredje part</li>
          <li>Eventuella skador, kostnader eller förluster som uppstår i samband med flytten</li>
        </ul>
      </LegalSection>

      <LegalSection heading="8. Ändringar av Tjänsten och villkoren">
        <p>Vi förbehåller oss rätten att ändra Tjänsten eller dessa Användarvillkor. Vid väsentliga ändringar informerar vi dig via e-post eller i Tjänsten. De senaste villkoren finns alltid tillgängliga på flytt.io.</p>
      </LegalSection>

      <LegalSection heading="9. Avsluta konto">
        <p>Du kan när som helst avsluta ditt konto genom att kontakta oss. Vi förbehåller oss rätten att stänga av konton vid missbruk av Tjänsten eller brott mot dessa Användarvillkor.</p>
      </LegalSection>

      <LegalSection heading="10. Tillämplig lag och tvist">
        <p>Dessa Användarvillkor regleras av svensk lag. Tvist ska i första hand lösas genom dialog. Om tvist inte kan lösas ska den avgöras av svensk allmän domstol.</p>
      </LegalSection>

      <LegalSection heading="11. Kontakt">
        <p>Flytt.io<br />E-post: info@flytt.io</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
