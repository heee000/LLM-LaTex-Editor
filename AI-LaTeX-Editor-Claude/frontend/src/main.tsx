import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Workbench } from "./pages/Workbench";
import { Templates } from "./pages/Templates";
import { AdminTemplates } from "./pages/AdminTemplates";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:projectId" element={<Workbench />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/admin/templates" element={<AdminTemplates />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
