'use client';

import { useRouter } from 'next/navigation';
import {
  portalCloseAction,
  portalPauseAction,
  portalRenewAction,
  portalResumeAction,
} from '@/actions/portal';
import { ActionButton } from '@/components/ui/action-button';
import { ConfirmButton } from '@/components/ui/confirm-button';

export function PortalSubscriptionActions({
  subscriptionId,
  paused,
  allowPause,
  allowRenew,
  allowEarlyClose,
}: {
  subscriptionId: string;
  paused: boolean;
  allowPause: boolean;
  allowRenew: boolean;
  allowEarlyClose: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {allowPause ? (
        paused ? (
          <ActionButton label="Resume subscription" action={() => portalResumeAction(subscriptionId)} />
        ) : (
          <ActionButton label="Pause subscription" action={() => portalPauseAction(subscriptionId)} />
        )
      ) : null}
      {allowRenew ? (
        <ActionButton label="Renew (+1 period)" variant="primary" action={() => portalRenewAction(subscriptionId)} />
      ) : null}
      {allowEarlyClose ? (
        <ConfirmButton
          label="Close subscription"
          variant="danger"
          confirmTitle="Close subscription"
          confirmMessage="Your subscription will close immediately and stop billing."
          onConfirm={async () => {
            await portalCloseAction(subscriptionId);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
