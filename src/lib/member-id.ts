// Tier → abbreviation used by generate_structured_member_id(_abbrev, _year).
// Output format per FAGE spec: FAGE/{ABBR}/{YEAR4}/{SEQ5}
//   AS = Associate
//   CR = Corporate
//   SB = Standard / Startup Business
export function tierAbbrev(tier: string | null | undefined): string {
  switch ((tier ?? "").toLowerCase()) {
    case "corporate":
      return "CR";
    case "standard":
      return "SB";
    case "associate":
    default:
      return "AS";
  }
}
