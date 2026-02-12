import { getAppById } from '@/lib/apps';
import { AppNavbar } from '@/components/layout/app-navbar';
import { notFound } from 'next/navigation';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const app = getAppById(appId);
  if (!app) return notFound();

  return (
    <div>
      <AppNavbar appId={appId} appName={app.name} appColor={app.color} />
      {children}
    </div>
  );
}
