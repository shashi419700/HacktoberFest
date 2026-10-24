import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const unlocked = localStorage.getItem("isUnlocked");

  if (!unlocked) {
    return <Navigate to="/" />;
  }

  return children;
}