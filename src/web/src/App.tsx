import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import MissionPage from '@/pages/MissionPage'
import SimulatePage from '@/pages/SimulatePage'
import FlightPage from '@/pages/FlightPage'
import ResultsPage from '@/pages/ResultsPage'
import PlantHistoryPage from '@/pages/PlantHistoryPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MissionPage />} />
          <Route path="simulate" element={<SimulatePage />} />
          <Route path="fly" element={<FlightPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="plants" element={<PlantHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
