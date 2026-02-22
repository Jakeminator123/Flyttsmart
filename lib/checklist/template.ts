export type ChecklistStatus = "todo" | "in_progress" | "done";

export interface ChecklistTask {
  taskKey: string;
  sectionKey: string;
  section: string;
  title: string;
  description?: string;
  dueDate?: string;
  category: string;
  sortOrder: number;
  needHelp: boolean;
  wantCompare: boolean;
  status: ChecklistStatus;
  comparisonHints: string[];
}

interface ChecklistTemplateRow {
  taskKey: string;
  sectionKey: string;
  section: string;
  title: string;
  description?: string;
  dayOffset: number;
  category: string;
  sortOrder: number;
  comparisonHints?: string[];
}

const TEMPLATE_ROWS: ChecklistTemplateRow[] = [
  {
    taskKey: "address_skv",
    sectionKey: "address_authorities",
    section: "1) Adress, post, myndigheter",
    title: "Folkbokforing/adressandring (Skatteverket)",
    dayOffset: -14,
    category: "administration",
    sortOrder: 1,
  },
  {
    taskKey: "mail_forwarding",
    sectionKey: "address_authorities",
    section: "1) Adress, post, myndigheter",
    title: "Eftersandning post",
    dayOffset: -14,
    category: "administration",
    sortOrder: 2,
    comparisonHints: [
      "Eftersandningens langd (3/6/12 man)",
      "Pris",
      "Vad som ingar",
    ],
  },
  {
    taskKey: "authority_updates",
    sectionKey: "address_authorities",
    section: "1) Adress, post, myndigheter",
    title: "Adress hos myndigheter/tjanster (t.ex. 1177, skola)",
    dayOffset: -7,
    category: "administration",
    sortOrder: 3,
  },
  {
    taskKey: "housing_notice",
    sectionKey: "housing_contracts",
    section: "2) Boende och avtal",
    title: "Uppsagning av hyresavtal / forsaljning bostadsratt",
    dayOffset: -45,
    category: "administration",
    sortOrder: 4,
  },
  {
    taskKey: "inspection_keys",
    sectionKey: "housing_contracts",
    section: "2) Boende och avtal",
    title: "Besiktning/overlamning/nycklar",
    dayOffset: -7,
    category: "practical",
    sortOrder: 5,
  },
  {
    taskKey: "cleaning_service",
    sectionKey: "housing_contracts",
    section: "2) Boende och avtal",
    title: "Flyttstadning",
    dayOffset: -14,
    category: "cleaning",
    sortOrder: 6,
    comparisonHints: [
      "Stadfirma: pris",
      "Garanti",
      "Vad som ingar",
    ],
  },
  {
    taskKey: "storage_gap",
    sectionKey: "housing_contracts",
    section: "2) Boende och avtal",
    title: "Magasinering (vid glapp mellan datum)",
    dayOffset: -21,
    category: "practical",
    sortOrder: 7,
    comparisonHints: [
      "Magasinering: m3",
      "Klimatkontroll",
      "Forsakring",
    ],
  },
  {
    taskKey: "electricity_contract",
    sectionKey: "utilities_insurance",
    section: "3) El, varme och hemforsakring",
    title: "Elavtal - saga upp/flytta/teckna nytt",
    dayOffset: -28,
    category: "administration",
    sortOrder: 8,
    comparisonHints: [
      "Rorligt eller fast",
      "Paslag",
      "Bindningstid",
    ],
  },
  {
    taskKey: "home_insurance",
    sectionKey: "utilities_insurance",
    section: "3) El, varme och hemforsakring",
    title: "Hemforsakring - flyttanmalan och justering",
    dayOffset: -21,
    category: "administration",
    sortOrder: 9,
    comparisonHints: [
      "Bostadstyp och boarea",
      "Sjalvrisk",
      "Drulle/skyddsniva",
    ],
  },
  {
    taskKey: "water_heating_gas",
    sectionKey: "utilities_insurance",
    section: "3) El, varme och hemforsakring",
    title: "Eventuellt: vatten/fjarrvarme/gas",
    dayOffset: -21,
    category: "administration",
    sortOrder: 10,
  },
  {
    taskKey: "bank_address",
    sectionKey: "bank_finance",
    section: "4) Bank och ekonomi",
    title: "Ny adress hos banken",
    dayOffset: -7,
    category: "administration",
    sortOrder: 11,
  },
  {
    taskKey: "autogiro_bills",
    sectionKey: "bank_finance",
    section: "4) Bank och ekonomi",
    title: "Autogiron/fakturor kopplat till adress",
    dayOffset: -7,
    category: "administration",
    sortOrder: 12,
  },
  {
    taskKey: "broadband_tech_check",
    sectionKey: "broadband_tech",
    section: "5) Bredband och teknik",
    title: "Kontrollera teknik pa nya adressen (fiber/coax/mobil)",
    dayOffset: -35,
    category: "practical",
    sortOrder: 13,
    comparisonHints: [
      "Tillgangliga leverantorer pa adressen",
      "Installationstid",
      "Stod for Wi-Fi 6/mesh",
    ],
  },
  {
    taskKey: "broadband_cancel_or_move",
    sectionKey: "broadband_tech",
    section: "5) Bredband och teknik",
    title: "Uppsagning nuvarande avtal / flytt av tjanst",
    dayOffset: -28,
    category: "administration",
    sortOrder: 14,
  },
  {
    taskKey: "broadband_order_install",
    sectionKey: "broadband_tech",
    section: "5) Bredband och teknik",
    title: "Bestalla nytt bredband och boka installation",
    dayOffset: -28,
    category: "administration",
    sortOrder: 15,
    comparisonHints: [
      "Pris efter kampanj",
      "Bindningstid",
      "Routerkostnad",
    ],
  },
  {
    taskKey: "wifi_plan",
    sectionKey: "broadband_tech",
    section: "5) Bredband och teknik",
    title: "Router/Wi-Fi-plan (placering, mesh vid behov)",
    dayOffset: -3,
    category: "practical",
    sortOrder: 16,
  },
  {
    taskKey: "speed_coverage_test",
    sectionKey: "broadband_tech",
    section: "5) Bredband och teknik",
    title: "Hastighets- och tackningstest efter inflytt",
    dayOffset: 2,
    category: "post_move",
    sortOrder: 17,
  },
  {
    taskKey: "movers_or_trailer",
    sectionKey: "move_logistics",
    section: "6) Flyttlogistik",
    title: "Flyttfirma eller hyra slap",
    dayOffset: -30,
    category: "practical",
    sortOrder: 18,
    comparisonHints: [
      "Flyttfirma: timpris eller fast pris",
      "Forsakring",
      "Omdomen",
    ],
  },
  {
    taskKey: "packing_material",
    sectionKey: "move_logistics",
    section: "6) Flyttlogistik",
    title: "Packmaterial (kartonger, bubbelplast)",
    dayOffset: -21,
    category: "practical",
    sortOrder: 19,
  },
  {
    taskKey: "parking_permit",
    sectionKey: "move_logistics",
    section: "6) Flyttlogistik",
    title: "Parkeringstillstand/lastzon flyttdag",
    dayOffset: -7,
    category: "administration",
    sortOrder: 20,
  },
  {
    taskKey: "safety_checks",
    sectionKey: "post_move",
    section: "7) Efter inflytt",
    title: "Sakerhet: brandvarnare, las, nyckelhantering",
    dayOffset: 1,
    category: "post_move",
    sortOrder: 21,
  },
  {
    taskKey: "subscriptions_update",
    sectionKey: "post_move",
    section: "7) Efter inflytt",
    title: "Adress uppdaterad hos abonnemang (mobil, streaming, larm)",
    dayOffset: 7,
    category: "post_move",
    sortOrder: 22,
  },
  {
    taskKey: "final_reconciliation",
    sectionKey: "post_move",
    section: "7) Efter inflytt",
    title: "Slutavstamning: post kommer ratt, avtal start/stop stammer",
    dayOffset: 14,
    category: "post_move",
    sortOrder: 23,
  },
];

function toIsoDate(moveDate: string | undefined, dayOffset: number): string {
  const base = moveDate ? new Date(moveDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    const today = new Date();
    today.setDate(today.getDate() + dayOffset);
    return today.toISOString().split("T")[0];
  }
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString().split("T")[0];
}

export function buildChecklistTemplate(input: {
  moveDate?: string;
  toCity?: string;
}): ChecklistTask[] {
  const { moveDate, toCity } = input;

  return TEMPLATE_ROWS.map((row) => {
    const citySuffix = toCity && row.category === "area_tips" ? ` i ${toCity}` : "";
    return {
      taskKey: row.taskKey,
      sectionKey: row.sectionKey,
      section: row.section,
      title: `${row.title}${citySuffix}`,
      description: row.description,
      dueDate: toIsoDate(moveDate, row.dayOffset),
      category: row.category,
      sortOrder: row.sortOrder,
      needHelp: false,
      wantCompare: false,
      status: "todo",
      comparisonHints: row.comparisonHints ?? [],
    };
  });
}
