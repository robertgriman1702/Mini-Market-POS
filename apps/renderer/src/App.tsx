import { useState, useEffect }       from 'react';
import { useQuery, useIPCEvent }      from '@/hooks';
import { Layout, type Page }          from '@/components/Layout';
import { LockScreen }                 from '@/components/LockScreen';
import { Login }                      from '@/pages/Login';
import { CajaModule } from './pages/CajaModule'; 
import { Inventory }                  from '@/pages/Inventory';
import { CashClose }                  from '@/pages/CashClose';
import { Settings }                   from '@/pages/Settings';
import { ipcInvoke }                   from '@/lib/ipc';
import type { AppConfig, LicenseEstado } from '@pos/shared';

const SESSION_KEY = 'pos_session_active';
const BLOCKED: LicenseEstado[] = ['invalid', 'expired', 'not_found'];

interface UpdateInfo {
  version:   string;
  status:    'available' | 'downloading' | 'ready';
  progress?: number;
}

export default function App() {
  const [page,       setPage]       = useState<Page>('pos');
  const [config,     setConfig]     = useState<AppConfig | null>(null);
  const [loggedIn,   setLoggedIn]   = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const { data: licenseData, refetch: recheckLicense } =
    useQuery('system:checkLicense');
  const { data: configData } = useQuery('config:get');

  useEffect(() => {
    if (configData) setConfig(configData);
  }, [configData]);

  // ── Eventos del auto-updater ──
  useIPCEvent('updater:available', ({ version }: { version: string }) => {
    setUpdateInfo({ version, status: 'available' });
  });
  useIPCEvent('updater:progress', (progress: number) => {
    setUpdateInfo((prev) => prev ? { ...prev, status: 'downloading', progress } : prev);
  });
  useIPCEvent('updater:ready', (version: string) => {
    setUpdateInfo({ version, status: 'ready' });
  });

  const handleLogin  = () => { sessionStorage.setItem(SESSION_KEY, '1'); setLoggedIn(true); };
  const handleLogout = () => { sessionStorage.removeItem(SESSION_KEY);   setLoggedIn(false); };

  const handleDownloadUpdate = () => {
    setUpdateInfo((prev) => prev ? { ...prev, status: 'downloading', progress: 0 } : prev);
    ipcInvoke('system:downloadUpdate').catch(() => {});
  };

  const handleInstallUpdate = () => {
    ipcInvoke('system:installUpdate').catch(() => {});
  };

  // ── 1. Splash ──
  if (!licenseData || !config) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-base)' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'radial-gradient(circle, #0d47a1, #0a1929)',
          boxShadow: '0 0 24px rgba(41,121,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%',
            background: 'radial-gradient(circle, #64b5f6, #1565c0)' }} />
        </div>
        <p className="text-xs font-mono uppercase tracking-widest animate-pulse"
          style={{ color: 'var(--text-muted)' }}>
          Iniciando sistema...
        </p>
      </div>
    );
  }

  // ── 2. License gate ──
  if (BLOCKED.includes(licenseData.estado)) {
    return <LockScreen status={licenseData} onUnlock={recheckLicense} />;
  }

  // ── 3. Login ──
  if (!loggedIn) {
    return (
      <Login config={config} license={licenseData} onLogin={handleLogin} />
    );
  }

  // ── 4. Main app ──
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">

      {/* Banner de actualización — aparece solo cuando hay update */}
      {updateInfo && (
        <UpdateBanner
          info={updateInfo}
          onDownload={handleDownloadUpdate}
          onInstall={handleInstallUpdate}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}

      <div className="flex-1 overflow-hidden">
        <Layout current={page} onChange={setPage} onLogout={handleLogout}>
          {page === 'pos' && <CajaModule config={config} />}
          {page === 'inventory'  && <Inventory config={config} />}
          {page === 'cash-close' && <CashClose config={config} />}
          {page === 'settings'   && <Settings  onConfigChange={setConfig} />}
        </Layout>
      </div>

    </div>
  );
}

// =============================================================================
// UpdateBanner
// =============================================================================

interface BannerProps {
  info:       UpdateInfo;
  onDownload: () => void;
  onInstall:  () => void;
  onDismiss:  () => void;
}

function UpdateBanner({ info, onDownload, onInstall, onDismiss }: BannerProps) {
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 16px', fontSize: '12px', flexShrink: 0, gap: '12px',
  };

  const CloseBtn = () => (
    <button onClick={onDismiss} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '0 4px',
    }}>×</button>
  );

  if (info.status === 'available') return (
    <div style={{ ...base, background: 'var(--blue-light)', borderBottom: '1px solid var(--blue-border)' }}
      className="animate-slide-down">
      <span style={{ color: 'var(--blue)' }}>
        🔄 Nueva versión disponible: <strong>v{info.version}</strong>
      </span>
      <div className="flex gap-2 items-center">
        <button className="btn-primary"
          style={{ padding: '4px 14px', fontSize: '11px', width: 'auto' }}
          onClick={onDownload}>
          Descargar ahora
        </button>
        <CloseBtn />
      </div>
    </div>
  );

  if (info.status === 'downloading') return (
    <div style={{ ...base, background: 'var(--blue-light)',
      borderBottom: '1px solid var(--blue-border)',
      flexDirection: 'column', alignItems: 'stretch', gap: '5px' }}
      className="animate-slide-down">
      <div className="flex justify-between" style={{ fontSize: '11px', color: 'var(--blue)' }}>
        <span>⬇ Descargando v{info.version}...</span>
        <span>{info.progress ?? 0}%</span>
      </div>
      <div style={{ height: '3px', background: 'var(--blue-border)', borderRadius: '2px' }}>
        <div style={{
          height: '100%', borderRadius: '2px', background: 'var(--blue)',
          width: `${info.progress ?? 0}%`, transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );

  // ready
  return (
    <div style={{ ...base, background: 'var(--green-light)', borderBottom: '1px solid var(--green-border)' }}
      className="animate-slide-down">
      <span style={{ color: 'var(--green)' }}>
        ✅ v{info.version} lista para instalar
      </span>
      <div className="flex gap-2 items-center">
        <button className="btn-primary"
          style={{ padding: '4px 14px', fontSize: '11px', width: 'auto', background: 'var(--green)' }}
          onClick={onInstall}>
          Reiniciar y actualizar
        </button>
        <CloseBtn />
      </div>
    </div>
  );
}
