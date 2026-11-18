import { ensureDefaultAdmin } from "@/actions/auth";
import { LoginForm } from "@/components/LoginForm";

export const instant = false;

export default async function LoginPage() {
  await ensureDefaultAdmin();

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <LoginForm />
    </main>
  );
}
