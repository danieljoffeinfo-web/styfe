import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isAllowedEmail } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // A network blip talking to Supabase must not 500 the whole app; treat it as
  // "not signed in" and let the login page say so.
  let user: { email?: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isPublic && !isAllowedEmail(user?.email)) {
    if (user) {
      // Signed in but not Dan. RLS already returns nothing; sign them out too.
      try {
        await supabase.auth.signOut();
      } catch {
        // Nothing more to do — the redirect below still keeps them out.
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = user ? "?error=not-allowed" : "";
    return NextResponse.redirect(url);
  }

  if (path === "/login" && isAllowedEmail(user?.email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
