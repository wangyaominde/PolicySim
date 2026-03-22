import { Outlet } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import Header from './Header';
import Sidebar from './Sidebar';
import ApiKeyModal from '../shared/ApiKeyModal';

export default function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <Header />
      <Sidebar />
      <main
        className="pt-16 transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? 64 : 224,
        }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <ApiKeyModal />
    </div>
  );
}
