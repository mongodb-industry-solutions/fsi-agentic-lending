/**
 * Preset scenarios for the Business Loan Risk Assessor "Example" button.
 * Each click cycles to the next scenario, pre-filling the business plan
 * description and pinning the map at the scenario's default location.
 * Chosen to showcase a spread of risk profiles (strong market, flood-prone
 * coastal, high-rent urban, expansion of an established operator).
 */
export const EXAMPLE_SCENARIOS = [
  {
    name: "Bakery — Portland, OR",
    address: "Portland, Oregon, USA",
    lat: 45.5231,
    lng: -122.6765,
    description:
      "Loan of $280,000 to open an artisan sourdough bakery and cafe in a walkable Portland neighborhood. " +
      "Funds cover leasehold improvements (ovens, proofing room, retail counter), 6 months of operating " +
      "cash reserve, and working capital. Owner is a career baker with 8 years at a well-known local " +
      "bakery, projecting $420,000 year-one revenue with 22% food-cost margin based on a signed letter " +
      "of intent on a 1,400 sq ft corner space with heavy foot traffic.",
  },
  {
    name: "Tex-Mex Restaurant — Houston, TX",
    address: "Houston, Texas, USA",
    lat: 29.7604,
    lng: -95.3698,
    description:
      "Loan of $350,000 to launch a 90-seat family Tex-Mex restaurant in Houston, near a growing " +
      "residential corridor. Funds cover kitchen build-out (hood system, venting, grease traps), " +
      "furniture, POS, and initial inventory. Owner couple previously ran a successful food truck for " +
      "5 years with $290,000 annual revenue; projections show $650,000 year-one restaurant revenue. " +
      "The site under consideration is a leased freestanding building in a low-lying area near a bayou.",
  },
  {
    name: "Coffee Shop Expansion — Boulder, CO",
    address: "Boulder, Colorado, USA",
    lat: 40.015,
    lng: -105.2705,
    description:
      "Loan of $190,000 to expand an established specialty coffee shop into a second Boulder location " +
      "with a small roastery. The original shop has 3 years of profitable operations, $510,000 annual " +
      "revenue, and a 4.8-star average across 900+ reviews. Funds cover roasting equipment, build-out " +
      "of a leased 900 sq ft space near the university, and two additional hires. Owner seeks SBA 7(a) " +
      "financing with 20% owner injection.",
  },
  {
    name: "Seafood Restaurant — Miami, FL",
    address: "Miami Beach, Florida, USA",
    lat: 25.7907,
    lng: -80.13,
    description:
      "Loan of $500,000 to open a 120-seat upscale waterfront seafood restaurant on Miami Beach. " +
      "Funds cover a full gut renovation of a leased 3,200 sq ft ocean-drive space, premium kitchen " +
      "equipment, dock bar build, and 9 months operating reserve. First-time restaurant owner, a " +
      "former hospitality executive with deep industry contacts but no P&L operating history, " +
      "projecting $1.4M year-one revenue. The property is ground-floor in a coastal flood zone with " +
      "king-tide exposure.",
  },
  {
    name: "Salon & Spa — Detroit, MI",
    address: "Detroit, Michigan, USA",
    lat: 42.3314,
    lng: -83.0458,
    description:
      "Loan of $150,000 to open a boutique salon and spa in a revitalizing Detroit neighborhood. " +
      "Owner is a licensed cosmetologist with 12 years experience and an existing 2,000-client " +
      "booking list from a leased suite. Funds cover build-out of a purchased 1,100 sq ft commercial " +
      "condo, plumbing for wash stations, and equipment. Projected $240,000 year-one revenue with " +
      "3 commissioned stylists joining at opening.",
  },
];
