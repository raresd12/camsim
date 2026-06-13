import { HashRouter, Route, Routes } from "react-router-dom";
import { Library } from "./ui/screens/Library";
import { Import } from "./ui/screens/Import";
import { MockLobby } from "./ui/screens/MockLobby";
import { AttemptRunner } from "./ui/screens/AttemptRunner";
import { Results } from "./ui/screens/Results";
import { Settings } from "./ui/screens/Settings";
import { GeneratorPrompt } from "./ui/screens/GeneratorPrompt";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/import" element={<Import />} />
        <Route path="/exam/:examId/lobby" element={<MockLobby />} />
        <Route path="/attempt/:attemptId/run" element={<AttemptRunner />} />
        <Route path="/attempt/:attemptId/results" element={<Results />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/generator" element={<GeneratorPrompt />} />
      </Routes>
    </HashRouter>
  );
}
