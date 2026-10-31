import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/app/(auth)/reset-password/reset-form';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Reset password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const token = str(params, 'token');
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="The reset link can be used once."
      footer={
        <Link href="/login" className="text-accent-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="form-error-summary" role="alert">
          This reset link is missing its token. Request a new link from the forgot-password page.
        </p>
      )}
    </AuthShell>
  );
}
