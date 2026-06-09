import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { getProfile } from '../lib/queries';

export function CalendarPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  const url = profile?.calendar_url;

  return (
    <>
      <PageHeader title="Calendário" subtitle="Sua Google Agenda integrada." />

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : !url ? (
        <EmptyState
          icon={<CalendarDays size={26} />}
          title="Agenda não configurada"
          hint="Cole o link de incorporação da sua Google Agenda em Configurações para vê-la aqui."
          action={
            <Link to="/configuracoes">
              <Button variant="soft">
                <Settings size={18} /> Abrir configurações
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <iframe
            src={url}
            title="Google Agenda"
            className="h-[70vh] w-full"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
      )}
    </>
  );
}
