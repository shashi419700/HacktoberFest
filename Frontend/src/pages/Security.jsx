import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLock, FiEye, FiEyeOff, FiHeart } from "react-icons/fi";

export default function Security() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);

  const navigate = useNavigate();

  const SECRET_PASSWORD = "shashi@nidhilove9900";

  const handleUnlock = () => {
    if (password === SECRET_PASSWORD) {
      localStorage.setItem("isUnlocked", "true");
      navigate("/nidhiAi");
    } else {
      setError(true);

      setTimeout(() => {
        setError(false);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-rose-200 to-pink-300 relative overflow-hidden">
      {/* Background Soft Glows */}
      <div className="absolute w-80 h-80 bg-pink-400/30 blur-[100px] rounded-full -left-10 -top-10"></div>
      <div className="absolute w-80 h-80 bg-rose-400/30 blur-[100px] rounded-full -right-10 -bottom-10"></div>

      {/* Main Card */}
      <div className="relative z-10 w-[380px] bg-white/70 backdrop-blur-2xl border border-white/60 rounded-3xl p-8 shadow-xl shadow-pink-200/50">
        {/* Icon Header */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-pink-400 to-rose-400 flex items-center justify-center shadow-lg shadow-pink-300/50 transform -rotate-3">
            <FiLock className="text-white text-3xl" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 text-center mt-6 flex items-center justify-center gap-2">
          Welcome <FiHeart className="text-pink-500 fill-pink-500 text-2xl" />
        </h1>

        <p className="text-center text-rose-600/80 font-medium mt-1">
          Enter your secret password
        </p>

        {/* Password Input Area */}
        <div className="relative mt-8">
          <input
            type={show ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className={`w-full bg-white/80 border ${
              error
                ? "border-rose-400 ring-2 ring-rose-200"
                : "border-pink-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
            } rounded-2xl px-5 py-4 text-gray-700 outline-none transition placeholder:text-pink-300 text-center font-semibold tracking-wider`}
          />

          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-4 top-4 text-pink-400 hover:text-pink-600 transition text-xl"
          >
            {show ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-rose-500 text-sm font-semibold text-center mt-3 bg-rose-50 py-1 rounded-lg border border-rose-100">
            Incorrect Password! Try again 💕
          </p>
        )}

        {/* Submit Button */}
        <button
          onClick={handleUnlock}
          className="mt-8 w-full py-4 rounded-2xl bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 active:scale-[0.98] transition-all text-white font-bold text-lg shadow-lg shadow-pink-300/60"
        >
          Unlock Magic
        </button>
      </div>
    </div>
  );
}
