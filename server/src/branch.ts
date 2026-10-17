/** The one branch for v1. `scripts/seed.ts` writes it to Firestore (branches/{id}); applications carry its id. */
export const DEFAULT_BRANCH = {
  id: "udupi-main",
  name: "Manipal Co-operative Bank, Udupi Main Branch",
  city: "Udupi",
  address: "Main Road, Udupi, Karnataka (sample address)",
  phone: "0820-2520111",
} as const;
