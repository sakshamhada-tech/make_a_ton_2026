import { AuthShell } from '@/components/auth/auth-shell';
import { SignupForm } from '@/app/(auth)/signup/signup-form';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your portal account"
      subtitle="View your subscriptions and invoices from Brightloop Software."
    >
      <SignupForm />
    </AuthShell>
  );
}
