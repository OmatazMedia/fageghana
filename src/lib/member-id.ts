// Tier → abbreviation used by generate_structured_member_id(_abbrev, _year).
// Output format: FAGE/{ABBR}/{YY}/{SEQ}
export function tierAbbrev(tier: string | null | undefined): string {
  switch ((tier ?? "").toLowerCase()) {
    case "corporate":
      return "CORP";
    case "standard":
      return "STD";
    case "associate":
    default:
      return "ASSOC";
  }
}
