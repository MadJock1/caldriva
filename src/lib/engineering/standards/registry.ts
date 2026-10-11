import { PROJECT_CATEGORIES, type ProjectCategory } from "../compliance/context";

export type Reference = {
  id: string; identifier: string; title: string; edition: string | null;
  amendments: string; publicationDate: string | null; effectiveDate: string | null;
  jurisdiction: "EU" | "INTERNATIONAL" | "PT" | "FR" | "DE" | "ES";
  categories: readonly ProjectCategory[]; conditions: string; source: string;
  lastVerificationDate: string | null; reviewStatus: "METADATA VERIFIED" | "SOURCE REVIEW REQUIRED";
  verificationScope: string; technicalRulesVerified: false;
};
export const INSTALLATIONS: readonly ProjectCategory[] = ["residential", "apartment_building", "commercial", "industrial", "pv", "ev"];
export const PRODUCTS: readonly ProjectCategory[] = ["assembly", "machinery", "control_cabinet"];
const oj = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02023D2723-20260430";
const machinery = "https://single-market-economy.ec.europa.eu/sectors/mechanical-engineering/machinery_en";
const pending = "Confirm current edition, amendments, national adoption and project-specific applicability from authoritative sources. No technical rules are licensed or implemented.";
function reference(id: string, identifier: string, title: string, categories: readonly ProjectCategory[], conditions: string, source: string, extra: Partial<Reference> = {}): Reference {
  return { id, identifier, title, categories, conditions, source, edition: null, amendments: "Not verified", publicationDate: null, effectiveDate: null, jurisdiction: "EU", lastVerificationDate: null, reviewStatus: "SOURCE REVIEW REQUIRED", verificationScope: pending, technicalRulesVerified: false, ...extra };
}
const metadata = { lastVerificationDate: "2026-10-11", reviewStatus: "METADATA VERIFIED" as const };
const cited = { ...metadata, verificationScope: "Identifier/title and cited edition checked in the LVD OJ consolidated list dated 2026-04-30. This does not establish the latest technical edition, machinery harmonisation, all amendments, national adoption or project conformity.", amendments: "Full technical amendment/corrigendum set requires publisher review" };

export const standardsRegistry: readonly Reference[] = [
  reference("lvd", "2014/35/EU", "Low Voltage Directive", PRODUCTS, "Electrical product within voltage scope and not excluded; assess the machinery interface separately.", "https://eur-lex.europa.eu/eli/dir/2014/35/oj/eng", { ...metadata, edition: "2014/35/EU (original act)", publicationDate: "2014-03-29", effectiveDate: "2016-04-20", verificationScope: "Original act identifier, scope and application date verified; latest consolidated amendments and exclusions require project review." }),
  reference("emc", "2014/30/EU", "Electromagnetic Compatibility Directive", PROJECT_CATEGORIES, "Determine apparatus versus fixed installation and scope exclusions. Fixed-installation obligations are distinct from product CE marking.", "https://eur-lex.europa.eu/eli/dir/2014/30/oj/eng", { ...metadata, edition: "2014/30/EU (original act)", publicationDate: "2014-03-29", effectiveDate: "2016-04-20", verificationScope: "Original act metadata and distinction between apparatus and fixed installations verified; amendments and detailed scope require review." }),
  reference("machinery-directive", "2006/42/EC", "Machinery Directive", ["machinery", "control_cabinet"], "Machinery placed on the market before 2027-01-20; exclusions and transition provisions require review.", machinery, { ...metadata, edition: "2006/42/EC", verificationScope: "Commission guidance confirms the pre-2027-01-20 machinery framework; detailed amendments and exclusions not verified." }),
  reference("machinery-regulation", "(EU) 2023/1230", "Machinery Regulation", ["machinery", "control_cabinet"], "General mandatory application from 2027-01-20; certain provisions apply earlier.", machinery, { ...metadata, edition: "2023/1230", effectiveDate: "2027-01-20", amendments: "Application-date corrigendum confirmed by Commission guidance; full amendment set requires review", verificationScope: "Commission guidance confirms corrected general application date, not the original OJ's erroneous January 14 date." }),
  reference("ecodesign", "Product-specific Ecodesign legislation", "Ecodesign applicability screening", PRODUCTS, "Only where a relevant product group and applicable implementing/delegated measure are identified; never blanket applicability.", "https://energy.ec.europa.eu/topics/energy-efficiency/energy-label-and-ecodesign_en"),
  reference("hd60364", "HD 60364 series", "Low-voltage electrical installations", INSTALLATIONS, "Select relevant parts and national implementation for the installation scope.", "https://standards.cencenelec.eu/"),
  reference("61439-1", "EN IEC / EN 61439-1", "Low-voltage assemblies — General rules", [...INSTALLATIONS, "assembly", "control_cabinet"], "Assembly assessment together with its relevant product part; not standalone conformity.", oj, { ...cited, edition: "EN 61439-1:2011 (OJ-listed)" }),
  reference("61439-2", "EN IEC / EN 61439-2", "Power switchgear and controlgear assemblies", [...INSTALLATIONS, "assembly", "control_cabinet"], "Power switchgear/controlgear assembly; pair with Part 1.", oj, { ...cited, edition: "EN 61439-2:2011 (OJ-listed)" }),
  reference("61439-3", "EN IEC / EN 61439-3", "Distribution boards operated by ordinary persons", [...INSTALLATIONS, "assembly", "control_cabinet"], "Confirm ordinary-person operation and full Part 3 scope; pair with Part 1.", oj, { ...cited, edition: "EN 61439-3:2012 (OJ-listed)", amendments: "AC:2019-04 is listed in the consulted OJ; full current technical amendment set not verified" }),
  reference("60204-1", "EN 60204-1", "Safety of machinery — Electrical equipment — General requirements", ["machinery", "control_cabinet"], "Electrical equipment of a machine; cabinet classification requires confirmation of machine integration.", oj, { ...cited, edition: "EN 60204-1:2018 (LVD OJ-listed)" }),
  reference("functional-safety", "EN ISO 13849 / EN IEC 62061", "Machinery safety-related control systems", ["machinery", "control_cabinet"], "Safety functions require a separate risk assessment and functional-safety evaluation.", "https://standards.cencenelec.eu/"),
  reference("60909", "IEC 60909 series", "Short-circuit current calculation methods", PROJECT_CATEGORIES, "Only with suitable network model, impedances and source data; EN adoption must be checked separately.", "https://webstore.iec.ch/", { jurisdiction: "INTERNATIONAL" }),
  reference("devices-cables", "Protective-device and cable product standards", "Equipment-specific standards selection", PROJECT_CATEGORIES, "Identify device and cable types before selecting parts and editions.", "https://standards.cencenelec.eu/"),
  reference("rtiebt", "RTIEBT / Portaria 949-A/2006", "Regras Técnicas das Instalações Elétricas de Baixa Tensão", INSTALLATIONS, "Portuguese low-voltage installation within national scope; verify consolidated text and amendments.", "https://data.dre.pt/eli/port/949-a/2006/09/11/p/dre/pt/html", { jurisdiction: "PT", verificationScope: "Official ELI endpoint required JavaScript during source review; consolidated text, dates and amendments remain unverified." }),
  reference("pt-installations", "Portuguese installation legislation and utility rules", "National installation, inspection and connection requirements", INSTALLATIONS, "Select legislation for installation type, connection and inspection responsibilities.", "https://www.dgeg.gov.pt/", { jurisdiction: "PT" }),
  reference("nf-c15-100", "NF C 15-100", "French low-voltage installation requirements", INSTALLATIONS, "France; future national pack.", "https://www.boutique.afnor.org/", { jurisdiction: "FR" }),
  reference("vde-0100", "DIN VDE 0100", "German low-voltage installation requirements", INSTALLATIONS, "Germany; future national pack.", "https://www.vde-verlag.de/", { jurisdiction: "DE" }),
  reference("rebt", "REBT", "Spanish low-voltage installation requirements", INSTALLATIONS, "Spain; future national pack, including relevant ITC-BT.", "https://www.boe.es/", { jurisdiction: "ES" }),
];
