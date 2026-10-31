import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/app/(auth)/forgot-password/forgot-form';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Forgot password' };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sent = str(params, 'sent');
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Request a reset link for your account."
      footer={
        <Link href="/login" className="text-accent-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
            If an account exists for that address, a reset link has been sent. In this development
            environment, open the Outbox page to read it.
          </p>
          <Link href="/login" className="inline-flex h-9 items-center rounded border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Back to sign in
          </Link>
        </div>
      ) : (
        <ForgotPasswordForm />
      )}
    </AuthShell>
  );
}
