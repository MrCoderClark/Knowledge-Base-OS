import { SetPasswordForm } from "./SetPasswordForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SetPasswordForm token={token} />;
}
