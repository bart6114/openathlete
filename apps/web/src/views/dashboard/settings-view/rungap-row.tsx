import {
  useRunGapConnectionQuery,
  useSetRunGapConnectionMutation,
} from '@/api/activity-import';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/paraglide/messages';
import { ChevronDown, Link2 } from 'lucide-react';
import { toast } from 'sonner';

import { SettingsCopyField, SettingsRow } from './settings-section';

export function RunGapRow() {
  return (
    <Collapsible data-connector-provider="RUNGAP">
      <SettingsRow title="RunGap" leading={<Link2 className="m-2 size-6" />}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="RunGap"
            className="size-11 [&[data-state=open]>svg]:rotate-180"
          >
            <ChevronDown className="size-4 transition-transform" />
          </Button>
        </CollapsibleTrigger>
      </SettingsRow>
      <CollapsibleContent className="border-t bg-muted/30">
        <RunGapOptions />
      </CollapsibleContent>
    </Collapsible>
  );
}

function RunGapOptions() {
  const query = useRunGapConnectionQuery();
  const mutation = useSetRunGapConnectionMutation();
  const connection = query.data?.connection;

  const toggle = (enabled: boolean) => {
    mutation.mutate(enabled, {
      onError: () =>
        toast.error(
          enabled
            ? m.failed_to_initiate_connection()
            : m.failed_to_disconnect(),
        ),
    });
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(m.rungap_copied());
    } catch {
      toast.error(m.rungap_copy_failed());
    }
  };

  return (
    <div className="space-y-3 px-4 py-3">
      {query.isPending ? (
        <Skeleton className="h-9 w-40" />
      ) : query.isLoadingError ? (
        <Button variant="outline" onClick={() => void query.refetch()}>
          {m.rungap_retry()}
        </Button>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {connection ? m.rungap_setup() : m.rungap_description()}
          </p>
          {connection && (
            <>
              <p className="text-sm font-medium">{m.rungap_webhook_url()}</p>
              <SettingsCopyField
                value={connection.url}
                onCopy={() => void copy(connection.url)}
              />
              <p className="text-sm font-medium">{m.rungap_passkey()}</p>
              <SettingsCopyField
                value={connection.passkey}
                onCopy={() => void copy(connection.passkey)}
              />
            </>
          )}
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => toggle(!connection)}
          >
            {connection ? m.disconnect() : m.connect()}
          </Button>
        </>
      )}
    </div>
  );
}
