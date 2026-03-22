import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import SimulationPage from './pages/SimulationPage';
import ReportPage from './pages/ReportPage';
import AgentsPage from './pages/AgentsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sim/:id" element={<SimulationPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/agents" element={<AgentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
