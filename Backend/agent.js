
import dotenv from "dotenv";
dotenv.config();

import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";

import fs from "fs-extra";
import path from "path";

import {
  START,
  END,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";

import nidhiPrompt from "./prompts/nidhiPrompt.js";

/* ===========================================
             OLLAMA MODEL
=========================================== */

const model = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  model: process.env.MODEL || "gemma4:e2b",
  temperature: 0.7,
  numPredict: 500,
});

/* ===========================================
              HISTORY FILE
=========================================== */

const HISTORY_PATH = path.join("chats", "history.json");

/* ===========================================
               LOAD HISTORY
=========================================== */

async function loadHistory() {
  try {
    await fs.ensureDir(path.dirname(HISTORY_PATH));

    if (!(await fs.pathExists(HISTORY_PATH))) {
      await fs.writeJson(HISTORY_PATH, []);
      return [];
    }

    const text = await fs.readFile(HISTORY_PATH, "utf8");

    if (!text.trim()) {
      return [];
    }

    const history = JSON.parse(text);

    return Array.isArray(history) ? history : [];
  } catch (err) {
    console.error("Load History Error:", err);
    return [];
  }
}

/* ===========================================
               SAVE HISTORY
=========================================== */

async function saveHistory(history) {
  try {
    await fs.ensureDir(path.dirname(HISTORY_PATH));

    await fs.writeJson(HISTORY_PATH, history, {
      spaces: 2,
    });
  } catch (err) {
    console.error("Save History Error:", err);
  }
}

/* ===========================================
        HISTORY → LANGCHAIN MESSAGES
=========================================== */

function convertHistory(history) {
  const messages = [
    new SystemMessage(nidhiPrompt),
  ];

  for (const chat of history) {
    if (chat.role === "user") {
      messages.push(new HumanMessage(chat.content));
    } else if (chat.role === "assistant") {
      messages.push(new AIMessage(chat.content));
    }
  }

  return messages;
}

/* ===========================================
                 CHAT NODE
=========================================== */

async function chatNode(state) {
  const history = await loadHistory();

  const messages = convertHistory(history);

  const latestMessage = state.messages.at(-1);

  messages.push(latestMessage);

  // Generate response using local Ollama model
  const response = await model.invoke(messages);

  const userContent =
    typeof latestMessage.content === "string"
      ? latestMessage.content
      : JSON.stringify(latestMessage.content);

  const assistantContent =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Save conversation
  history.push(
    {
      role: "user",
      content: userContent,
    },
    {
      role: "assistant",
      content: assistantContent,
    }
  );

  // Keep the latest 100 messages
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }

  await saveHistory(history);

  return {
    messages: [response],
  };
}

/* ===========================================
                BUILD GRAPH
=========================================== */

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("chat", chatNode)
  .addEdge(START, "chat")
  .addEdge("chat", END);

const graph = workflow.compile();

/* ===========================================
                CHAT FUNCTION
=========================================== */

export async function chatWithNidhi(message) {
  const result = await graph.invoke({
    messages: [new HumanMessage(message)],
  });

  const response = result.messages.at(-1)?.content;

  return typeof response === "string"
    ? response
    : JSON.stringify(response ?? "");
}

export default graph;
