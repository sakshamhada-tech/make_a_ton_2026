import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/app/(auth)/login/login-form';
import Link from 'next/link';
import { str, type SearchParams } from '@/lib/http';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  let notice: string | undefined;
  if (str(params, 'signedup')) notice = 'Account created. Sign in with your email and password.';
  if (str(params, 'reset')) notice = 'Password updated. Sign in with your new password.';
  return (
    <AuthShell
      title="Sign in"
      subtitle="Access Brightloop Billing."
      footer={
        <>
          New customer?{' '}
          <Link href="/signup" className="text-accent-text hover:underline">
            Create a portal account
          </Link>
        </>
      }
    >
      <LoginForm notice={notice} />
    </AuthShell>
  );
}
