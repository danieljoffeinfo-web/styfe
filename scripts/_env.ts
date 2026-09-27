import "dotenv/config";
import { config } from "dotenv";

// .env.local wins over .env, like Next.js.
config({ path: ".env.local", override: true });

export function need(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n  Missing ${name}.`);
    console.error(`  Put it in .env.local — see .env.example and README.md.\n`);
    process.exit(1);
  }
  return value;
}

export const SUPABASE_URL = () => need("NEXT_PUBLIC_SUPABASE_URL");
export const SECRET_KEY = () => need("SUPABASE_SECRET_KEY");
export const DB_URL = () => need("SUPABASE_DB_URL");
export const OWNER_EMAIL = "danieljoffeinfo@gmail.com";

/** Red / green console output without pulling in a dependency. */
export const red = (s: string) => `\u001b[31m${s}\u001b[0m`;
export const green = (s: string) => `\u001b[32m${s}\u001b[0m`;
export const dim = (s: string) => `\u001b[2m${s}\u001b[0m`;
export const bold = (s: string) => `\u001b[1m${s}\u001b[0m`;
