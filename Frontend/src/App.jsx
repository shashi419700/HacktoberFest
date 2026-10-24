import { BrowserRouter, Routes, Route } from "react-router-dom";
import Security from "./pages/Security";
import NidhiAi from "./pages/nidhiAi"; // Uppercase variable
import ProtectedRoute from "./pages/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Security />} />

        <Route
          path="/nidhiAi"
          element={
            <ProtectedRoute>
              <NidhiAi />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;