import { AppShell } from "@/components/app-shell";
import { ThreadView } from "@/components/thread-view";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const { account } = await searchParams;

  return (
    <AppShell>
      <ThreadView threadId={id} accountId={account} />
    </AppShell>
  );
}
