import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Schedule from "./pages/Schedule.jsx";
import Roster from "./pages/Roster.jsx";
import Standings from "./pages/Standings.jsx";
import Leaders from "./pages/Leaders.jsx";
import Teams from "./pages/Teams.jsx";
import News from "./pages/News.jsx";
import Scores from "./pages/Scores.jsx";
import Player from "./pages/Player.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/leaders" element={<Leaders />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/news" element={<News />} />
        <Route path="/scores" element={<Scores />} />
        <Route path="/player/:id" element={<Player />} />
        <Route path="*" element={<div className="card p-8 text-center">Page not found.</div>} />
      </Routes>
    </Layout>
  );
}
