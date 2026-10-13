const LOCATION_SUFFIX = /\s+\((?:DEPOK|LK)\)\s*$/i;

/** Hide internal price-location labels on customer-facing documents. */
export function itemNameForCustomer(name: string): string {
  return name.replace(LOCATION_SUFFIX, "").trim();
}
