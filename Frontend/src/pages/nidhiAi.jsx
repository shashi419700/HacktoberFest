import React, { useCallback, useEffect, useRef, useState } from "react";

import axios from "axios";

import { motion, AnimatePresence } from "framer-motion";

import {
  FiSend,
  FiImage,
  FiTrash2,
  FiMic,
  FiX,
  FiVolume2,
  FiVolumeX,
  FiMaximize2,
} from "react-icons/fi";

import { BsStars } from "react-icons/bs";

import nidhiPhoto from "../assets/nidhi.jpg";

const API = axios.create({
  baseURL: "http://10.218.48.63:5000/api/chat",

  timeout: 120000,

  headers: {
    "Content-Type": "application/json",
  },
});

const formatTime = (date) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",

    minute: "2-digit",
  });

const INITIAL_MESSAGE = {
  sender: "ai",

  text: " Hi! Shashi kise ho. aaj ka din kisa tha?",

  time: formatTime(new Date()),
};

export default function NidhiAi() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);

  const [prompt, setPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  const [photoOpen, setPhotoOpen] = useState(false);

  // Voice states

  const [voiceMode, setVoiceMode] = useState(false);

  const [listening, setListening] = useState(false);

  const [speaking, setSpeaking] = useState(false);

  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const bottomRef = useRef(null);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const recognitionRef = useRef(null);

  const mountedRef = useRef(true);

  /* =========================================================

     AUTO SCROLL

  ========================================================= */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",

      block: "nearest",
    });
  }, [messages, loading]);

  /* =========================================================

     CLEANUP

  ========================================================= */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      recognitionRef.current?.stop();

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* =========================================================

     STOP SPEAKING

  ========================================================= */

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }, []);

  /* =========================================================

     TEXT TO SPEECH

  ========================================================= */

  const speakText = useCallback(
    (text) => {
      if (!voiceEnabled || !("speechSynthesis" in window)) return;

      if (typeof text !== "string" || !text.trim()) return;

      const synth = window.speechSynthesis;

      synth.cancel();

      // Remove emojis, markdown, URLs and non-spoken formatting

      const cleanText = text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/[#*_~`>|]/g, " ")
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ")
        .replace(/&nbsp;|&amp;|&lt;|&gt;/gi, " ")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Validation: don't speak empty or excessively long messages

      if (!cleanText || cleanText.length < 2) return;

      const speechText = cleanText.slice(0, 1800);

      let voiceChangeHandler;

      const speak = () => {
        if (!voiceEnabled || !mountedRef.current) return;

        const voices = synth.getVoices();

        const hindiVoices = voices.filter((voice) =>
          /^hi([-\_]IN)?$/i.test(voice.lang),
        );

        const selectedVoice =
          hindiVoices.find((v) => /swara/i.test(v.name)) ||
          hindiVoices.find((v) => /natural|online/i.test(v.name)) ||
          hindiVoices.find((v) => /female|heera|kalpana|priya/i.test(v.name)) ||
          hindiVoices[0] ||
          voices.find((v) => /^en-IN/i.test(v.lang)) ||
          null;

        const utterance = new SpeechSynthesisUtterance(speechText);

        if (selectedVoice) {
          utterance.voice = selectedVoice;

          utterance.lang = selectedVoice.lang;
        } else {
          utterance.lang = "hi-IN";
        }

        // Warm, gentle, conversational delivery

        utterance.rate = 0.93;

        utterance.pitch = 1.06;

        utterance.volume = 1;

        utterance.onstart = () => {
          if (mountedRef.current) setSpeaking(true);
        };

        utterance.onend = () => {
          if (mountedRef.current) setSpeaking(false);
        };

        utterance.onerror = () => {
          if (mountedRef.current) setSpeaking(false);
        };

        synth.speak(utterance);
      };

      if (synth.getVoices().length === 0) {
        voiceChangeHandler = () => {
          synth.removeEventListener(
            "voiceschanged",

            voiceChangeHandler,
          );

          speak();
        };

        synth.addEventListener("voiceschanged", voiceChangeHandler);
      } else {
        speak();
      }
    },

    [voiceEnabled],
  );

  /* =========================================================

     SEND MESSAGE

  ========================================================= */

  const sendMessage = useCallback(
    async (voiceText = null) => {
      const question = String(voiceText ?? prompt).trim();
      if ((!question && selectedImages.length === 0) || loading) return;

      const imagePreviews = selectedImages.map((image) => image.preview);
      const userMessage = {
        sender: "user",
        text: question,
        images: imagePreviews,
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const images = await Promise.all(
          selectedImages.map(
            (image) =>
              new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ""));
                reader.onerror = () =>
                  reject(new Error("Image read nahi ho payi."));
                reader.readAsDataURL(image.file);
              }),
          ),
        );
        const response = await API.post("/", { message: question, images });
        const reply =
          response?.data?.reply || "Sorry, mujhe abhi reply nahi mila. 💗";
        if (!mountedRef.current) return;

        setPrompt("");
        selectedImages.forEach((image) => URL.revokeObjectURL(image.preview));
        setSelectedImages([]);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: reply,
            time: formatTime(new Date()),
          },
        ]);

        if (voiceMode && voiceEnabled) {
          window.setTimeout(() => {
            if (mountedRef.current) speakText(reply);
          }, 250);
        }
      } catch (error) {
        console.error("Chat error:", error);
        if (!mountedRef.current) return;
        const errorText =
          error?.code === "ECONNABORTED"
            ? "Response aane mein thoda zyada time lag raha hai. Thoda ruko yaar. 💗"
            : error?.response?.data?.message ||
              "Shashi ek baar server check kro. 🤭";
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: errorText,
            time: formatTime(new Date()),
          },
        ]);
        if (voiceMode && voiceEnabled) speakText(errorText);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    },
    [loading, prompt, selectedImages, speakText, voiceEnabled, voiceMode],
  );

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }

    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser. Chrome ya Edge try karo.",
      );

      return;
    }

    if (loading) return;

    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore.
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "hi-IN";

    recognition.continuous = false;

    recognition.interimResults = true;

    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (mountedRef.current) {
        setListening(true);

        setPrompt("");
      }
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      if (mountedRef.current && transcript) {
        setPrompt(transcript);
      }

      const lastResult = event.results[event.results.length - 1];

      if (lastResult?.isFinal && transcript) {
        window.setTimeout(() => {
          if (mountedRef.current) {
            sendMessage(transcript);
          }
        }, 150);
      }
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition:", event.error);

      if (mountedRef.current) {
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (mountedRef.current) {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Could not start microphone:", error);

      setListening(false);
    }
  }, [loading, sendMessage]);

  /* =========================================================

     VOICE MODE

  ========================================================= */

  const closeVoiceMode = useCallback(() => {
    stopListening();

    stopSpeaking();

    setVoiceMode(false);
  }, [stopListening, stopSpeaking]);

  const toggleVoiceMode = () => {
    if (voiceMode) {
      closeVoiceMode();
    } else {
      setVoiceMode(true);
    }
  };

  /* =========================================================

     CLEAR CHAT

  ========================================================= */

  const clearChat = () => {
    stopSpeaking();

    setMessages([
      {
        sender: "ai",

        text: "Shashi Chat clear ho gaya hai! Kuch bol rhe the kiya ? ✨",

        time: formatTime(new Date()),
      },
    ]);

    setPrompt("");
    selectedImages.forEach((image) => URL.revokeObjectURL(image.preview));
    setSelectedImages([]);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  /* =========================================================

     KEYBOARD

  ========================================================= */

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (event.key !== "Escape") return;

      setPhotoOpen(false);

      if (voiceMode) {
        closeVoiceMode();
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [closeVoiceMode, voiceMode]);

  /* =========================================================

     AVATAR

  ========================================================= */

  const Avatar = ({
    size = "normal",

    clickable = true,
  }) => {
    const classes =
      size === "large"
        ? "w-24 h-24 sm:w-28 sm:h-28"
        : size === "small"
          ? "w-9 h-9 sm:w-10 sm:h-10"
          : "w-14 h-14 sm:w-16 sm:h-16";

    const image = (
      <div
        className={`${classes} rounded-full overflow-hidden border-2 border-white shadow-lg ring-2 ring-[#FFB6C1]/40`}
      >
        <img
          src={nidhiPhoto}
          alt="Nidhi AI"
          className="w-full h-full object-cover"
          draggable="false"
        />
      </div>
    );

    if (!clickable) return image;

    return (
      <button
        type="button"
        onClick={() => setPhotoOpen(true)}
        className="relative group shrink-0 focus:outline-none"
        aria-label="Open Nidhi photo"
      >
        {image}

        <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
          <FiMaximize2
            size={size === "large" ? 20 : 15}
            className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity"
          />
        </span>
      </button>
    );
  };

  return (
    <div className="h-[100dvh] min-h-[520px] overflow-hidden bg-gradient-to-br from-[#FFF0F5] via-[#FFE4EC] to-[#FFD9E8] text-[#5B2140] flex flex-col font-sans">
      {/* =====================================================

          HEADER

      ====================================================== */}

      <header className="shrink-0 h-[72px] sm:h-[82px] bg-white/60 backdrop-blur-xl border-b border-[#FFB6C1]/40 shadow-sm z-40">
        <div className="h-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <Avatar />

            <div className="ml-3 sm:ml-4 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[#C2185B] flex items-center gap-1">
                Nidhi AI
                <BsStars size={15} className="text-[#FF6B9D]" />
              </h1>

              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,.6)]" />

                <span className="text-xs sm:text-sm font-medium text-[#E0578E]">
                  {voiceMode ? "Voice mode" : "Online"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceMode}
              aria-label="Toggle voice mode"
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
                voiceMode
                  ? "bg-[#FF6B9D] text-white border-[#FF6B9D] shadow-md"
                  : "bg-white/80 text-[#C2185B] border-[#FFB6C1]/60 hover:bg-[#FFF0F5]"
              }`}
            >
              {voiceMode ? <FiVolume2 size={18} /> : <FiMic size={18} />}
            </button>

            <button
              type="button"
              onClick={clearChat}
              aria-label="Clear chat"
              className="h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-white/80 border border-[#FFB6C1]/60 text-[#C2185B] hover:bg-[#FF6B9D] hover:text-white transition-all flex items-center gap-2 active:scale-95"
            >
              <FiTrash2 size={15} />

              <span className="hidden sm:block text-sm">Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================

          CHAT

      ====================================================== */}

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isAI = message.sender === "ai";

              return (
                <motion.div
                  key={`${index}-${message.time}`}
                  initial={{
                    opacity: 0,

                    y: 10,
                  }}
                  animate={{
                    opacity: 1,

                    y: 0,
                  }}
                  transition={{
                    duration: 0.2,
                  }}
                  className={`flex items-end mb-5 ${
                    isAI ? "justify-start" : "justify-end"
                  }`}
                >
                  {isAI && <Avatar size="small" />}

                  <div
                    className={`max-w-[82%] sm:max-w-[70%] ${
                      isAI ? "ml-2.5 sm:ml-3" : ""
                    }`}
                  >
                    <div
                      className={`px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-[15px] leading-relaxed break-words ${
                        isAI
                          ? "bg-white/85 backdrop-blur-xl border border-[#FFD1DE] rounded-[22px] rounded-bl-[7px] shadow-sm"
                          : "bg-gradient-to-tr from-[#FF6B9D] to-[#FF8FB3] text-white rounded-[22px] rounded-br-[7px] shadow-md shadow-[#FF6B9D]/15"
                      }`}
                    >
                      {message.images?.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {message.images.map((src, imageIndex) => (
                            <img
                              key={`${imageIndex}-${src}`}
                              src={src}
                              alt={`Uploaded image ${imageIndex + 1}`}
                              className="max-h-56 max-w-full rounded-xl border border-[#FFD1DE]/70 object-contain"
                            />
                          ))}
                        </div>
                      )}
                      {message.text}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-2 ${
                        isAI ? "ml-1" : "justify-end mr-1"
                      }`}
                    >
                      <span className="text-[10px] text-[#C2185B]/55">
                        {message.time}
                      </span>

                      {isAI && (
                        <button
                          type="button"
                          onClick={() =>
                            speaking ? stopSpeaking() : speakText(message.text)
                          }
                          aria-label={
                            speaking ? "Stop speaking" : "Read message aloud"
                          }
                          className="text-[#C2185B]/45 hover:text-[#FF6B9D] transition-colors"
                        >
                          {speaking ? (
                            <FiVolumeX size={13} />
                          ) : (
                            <FiVolume2 size={13} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* =================================================

              TYPING

          ================================================== */}

          {loading && (
            <motion.div
              initial={{
                opacity: 0,

                y: 8,
              }}
              animate={{
                opacity: 1,

                y: 0,
              }}
              className="flex items-end gap-2.5 mb-4"
            >
              <Avatar size="small" />

              <div className="bg-white/85 border border-[#FFD1DE] rounded-[22px] rounded-bl-[7px] px-5 py-4 flex items-center gap-1.5 shadow-sm">
                {[0, 1, 2].map((item) => (
                  <motion.span
                    key={item}
                    className="w-2 h-2 rounded-full bg-[#FF6B9D]"
                    animate={{
                      y: [0, -4, 0],

                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      repeat: Infinity,

                      duration: 0.8,

                      delay: item * 0.13,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* =====================================================

          VOICE EXPERIENCE

      ====================================================== */}

      <AnimatePresence>
        {voiceMode && (
          <motion.div
            initial={{
              opacity: 0,

              y: 25,

              scale: 0.97,
            }}
            animate={{
              opacity: 1,

              y: 0,

              scale: 1,
            }}
            exit={{
              opacity: 0,

              y: 25,

              scale: 0.97,
            }}
            transition={{
              duration: 0.2,
            }}
            className="fixed z-50 left-3 right-3 bottom-[86px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[430px]"
          >
            <div className="rounded-[30px] bg-white/90 backdrop-blur-2xl border border-white/70 shadow-2xl shadow-[#9E174E]/15 overflow-hidden">
              {/* Voice top bar */}

              <div className="px-5 pt-5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#C2185B]">Nidhi AI</p>

                  <p className="text-xs text-[#C2185B]/50 mt-0.5">
                    {listening
                      ? "Listening..."
                      : speaking
                        ? "Speaking..."
                        : "Voice conversation"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeVoiceMode}
                  className="w-9 h-9 rounded-full bg-[#FFF0F5] text-[#C2185B] flex items-center justify-center hover:bg-[#FF6B9D] hover:text-white transition-colors"
                  aria-label="Close voice mode"
                >
                  <FiX size={17} />
                </button>
              </div>

              {/* Voice visualizer */}

              <div className="relative h-52 flex items-center justify-center">
                {(listening || speaking) && (
                  <>
                    <motion.div
                      className="absolute w-44 h-44 rounded-full border border-[#FF6B9D]/20"
                      animate={{
                        scale: [0.9, 1.15, 0.9],

                        opacity: [0.15, 0.6, 0.15],
                      }}
                      transition={{
                        repeat: Infinity,

                        duration: 1.8,

                        ease: "easeInOut",
                      }}
                    />

                    <motion.div
                      className="absolute w-36 h-36 rounded-full bg-[#FF6B9D]/5"
                      animate={{
                        scale: [0.9, 1.12, 0.9],
                      }}
                      transition={{
                        repeat: Infinity,

                        duration: 1.2,

                        ease: "easeInOut",
                      }}
                    />
                  </>
                )}

                <motion.button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  whileTap={{
                    scale: 0.94,
                  }}
                  animate={
                    listening
                      ? {
                          scale: [1, 1.045, 1],
                        }
                      : {
                          scale: 1,
                        }
                  }
                  transition={{
                    repeat: listening ? Infinity : 0,

                    duration: 1,
                  }}
                  className="relative z-10 w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-2xl ring-4 ring-[#FFB6C1]/30 focus:outline-none"
                  aria-label={listening ? "Stop listening" : "Start listening"}
                >
                  <img
                    src={nidhiPhoto}
                    alt="Nidhi AI"
                    className="w-full h-full object-cover"
                  />

                  <span className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-white/90 text-[#C2185B] flex items-center justify-center shadow-lg">
                      {listening ? <FiMic size={21} /> : <FiMic size={21} />}
                    </span>
                  </span>
                </motion.button>
              </div>

              {/* Voice status */}

              <div className="text-center px-5">
                <p className="text-sm font-semibold text-[#C2185B]">
                  {listening
                    ? "Sun rahi hoon..."
                    : speaking
                      ? "Nidhi bol rahi hai..."
                      : "Mic dabakar baat karein"}
                </p>

                <p className="text-[11px] text-[#C2185B]/45 mt-1">
                  Hindi aur Hinglish mein bol sakte ho
                </p>
              </div>

              {/* Voice controls */}

              <div className="px-5 pb-6 pt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (voiceEnabled) {
                      stopSpeaking();
                    }

                    setVoiceEnabled((value) => !value);
                  }}
                  className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all ${
                    voiceEnabled
                      ? "bg-[#FFF0F5] text-[#C2185B] border-[#FFD1DE]"
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  aria-label={voiceEnabled ? "Mute Nidhi" : "Unmute Nidhi"}
                >
                  {voiceEnabled ? (
                    <FiVolume2 size={18} />
                  ) : (
                    <FiVolumeX size={18} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  disabled={loading}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                    listening
                      ? "bg-[#C2185B]"
                      : "bg-gradient-to-tr from-[#FF6B9D] to-[#FF8FB3]"
                  }`}
                  aria-label={listening ? "Stop listening" : "Start listening"}
                >
                  <FiMic size={22} />
                </button>

                <button
                  type="button"
                  onClick={closeVoiceMode}
                  className="w-11 h-11 rounded-full border border-[#FFD1DE] bg-[#FFF0F5] text-[#C2185B] flex items-center justify-center"
                  aria-label="Close voice mode"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================

          INPUT

      ====================================================== */}

      <footer className="shrink-0 bg-white/60 backdrop-blur-xl border-t border-[#FFB6C1]/40 px-3 sm:px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] z-40">
        <div className="max-w-4xl mx-auto">
          {selectedImages.length > 0 && (
            <div className="mb-3 flex gap-3 overflow-x-auto px-1 pb-2">
              {selectedImages.map((image, index) => (
                <div key={image.preview} className="relative shrink-0">
                  <img
                    src={image.preview}
                    alt={`Selected image ${index + 1}`}
                    className="h-20 w-20 rounded-2xl border border-[#FFD1DE] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(image.preview);
                      setSelectedImages((previous) =>
                        previous.filter((_, i) => i !== index),
                      );
                    }}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#C2185B] text-white shadow"
                    aria-label="Remove image"
                    title="Remove image"
                  >
                    <FiX size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                const remaining = 4 - selectedImages.length;
                const accepted = [];
                for (const file of files) {
                  if (accepted.length >= remaining) break;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    alert(`${file.name}: JPEG, PNG ya WebP image select karo.`);
                    continue;
                  }
                  if (file.size > 2 * 1024 * 1024) {
                    alert(`${file.name}: image 2 MB se chhoti honi chahiye.`);
                    continue;
                  }
                  accepted.push({ file, preview: URL.createObjectURL(file) });
                }
                setSelectedImages((previous) => [...previous, ...accepted]);
                if (files.length > remaining)
                  alert("Maximum 4 images upload kar sakte ho.");
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || selectedImages.length >= 4}
              className="shrink-0 h-11 w-11 rounded-full border border-[#FFD1DE] bg-white/90 text-[#C2185B] flex items-center justify-center hover:bg-[#FFF0F5] disabled:opacity-40"
              aria-label="Upload image"
              title="Upload image"
            >
              <FiImage size={19} />
            </button>

            <div className="flex-1 min-w-0">
              <input
                ref={inputRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();

                    sendMessage();
                  }
                }}
                disabled={loading}
                autoComplete="off"
                enterKeyHint="send"
                className="w-full h-12 sm:h-14 bg-white/90 border border-[#FFD1DE] rounded-full px-5 text-sm sm:text-base text-[#5B2140] placeholder:text-[#C2185B]/45 outline-none focus:border-[#FF6B9D] focus:ring-2 focus:ring-[#FF6B9D]/10 transition-all disabled:opacity-60"
                placeholder="Kise ho..."
              />
            </div>

            {/* Mic */}

            <button
              type="button"
              onClick={toggleVoiceMode}
              className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                voiceMode
                  ? "bg-[#FF6B9D] text-white border-[#FF6B9D]"
                  : "bg-white/90 text-[#C2185B] border-[#FFD1DE] hover:bg-[#FFF0F5]"
              }`}
              aria-label="Open voice mode"
            >
              <FiMic size={18} />
            </button>

            {/* Send */}

            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={
                loading || (!prompt.trim() && selectedImages.length === 0)
              }
              className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#FF6B9D] to-[#FF8FB3] text-white flex items-center justify-center shadow-lg shadow-[#FF6B9D]/20 active:scale-95 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-all"
              aria-label="Send message"
            >
              <FiSend size={20} />
            </button>
          </div>

          <p className="text-center text-[9px] sm:text-[10px] text-[#C2185B]/35 mt-2">
            Nidhi AI • Only For Shashi AI assistant ✨
          </p>
        </div>
      </footer>

      {/* =====================================================

          PHOTO LIGHTBOX

      ====================================================== */}

      <AnimatePresence>
        {photoOpen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={() => setPhotoOpen(false)}
            className="fixed inset-0 z-[100] bg-[#260c1b]/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                setPhotoOpen(false);
              }}
              className="absolute top-4 right-4 sm:top-7 sm:right-7 w-11 h-11 rounded-full bg-white/15 border border-white/25 text-white flex items-center justify-center hover:bg-white/25 transition-colors"
              aria-label="Close photo"
            >
              <FiX size={21} />
            </button>

            <motion.div
              initial={{
                scale: 0.88,

                opacity: 0,
              }}
              animate={{
                scale: 1,

                opacity: 1,
              }}
              exit={{
                scale: 0.88,

                opacity: 0,
              }}
              transition={{
                type: "spring",

                stiffness: 260,

                damping: 22,
              }}
              onClick={(event) => event.stopPropagation()}
              className="relative max-w-[92vw] max-h-[82dvh] overflow-hidden rounded-[28px] border-4 border-white/80 shadow-2xl"
            >
              <img
                src={nidhiPhoto}
                alt="Nidhi"
                draggable="false"
                className="block max-w-[92vw] max-h-[82dvh] w-auto h-auto object-contain"
              />

              <div className="absolute left-0 right-0 bottom-0 px-5 pt-12 pb-5 bg-gradient-to-t from-black/65 to-transparent">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.8)]" />

                  <div>
                    <p className="text-white font-semibold">Nidhi AI</p>

                    <p className="text-white/70 text-xs">Online</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
