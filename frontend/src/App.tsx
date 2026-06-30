import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Editor from "./pages/Editor";
import Templates from "./pages/Templates";
import AdminTemplates from "./pages/AdminTemplates";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/editor/:projectId?" element={<Editor />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/admin/templates" element={<AdminTemplates />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
