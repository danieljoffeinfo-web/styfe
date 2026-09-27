import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Styfe HQ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="eyebrow">Styfe</p>
          <h1 className="serif mt-2 text-5xl leading-none">Styfe HQ</h1>
          <p className="mt-3 text-sm text-muted">
            Sign in with a magic link. One address is allowed.
          </p>
        </div>

        {error === "not-allowed" ? (
          <p className="mb-4 rounded-[10px] bg-alert-wash px-4 py-3 text-[13px] text-alert">
            That address is not allowed to use Styfe HQ.
          </p>
        ) : null}
        {error === "link-expired" ? (
          <p className="mb-4 rounded-[10px] bg-alert-wash px-4 py-3 text-[13px] text-alert">
            That link has expired or was already used. Send yourself a new one.
          </p>
        ) : null}

        <LoginForm />
      </div>
    </main>
  );
}
