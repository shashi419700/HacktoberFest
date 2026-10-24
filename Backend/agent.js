import dotenv from "dotenv";
dotenv.config();

import fs from "fs-extra";
import path from "path";

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { ChatOllama } from "@langchain/ollama";

import {
  START,
  END,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";

import nidhiPrompt from "./prompts/nidhiPrompt.js";

const model = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  model: process.env.MODEL || "gemma4:e2b",
  temperature: 0.7,
  numPredict: 500,
});

const HISTORY_PATH = path.join(
  process.cwd(),
  "chats",
  "history.json"
);

async function loadHistory() {
  try {
    await fs.ensureDir(path.dirname(HISTORY_PATH));

    if (!(await fs.pathExists(HISTORY_PATH))) {
      await fs.writeJson(HISTORY_PATH, []);
      return [];
    }

    const history = await fs.readJson(HISTORY_PATH);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error("History load error:", error);
    return [];
  }
}

async function saveHistory(history) {
  await fs.ensureDir(path.dirname(HISTORY_PATH));
  await fs.writeJson(HISTORY_PATH, history, { spaces: 2 });
}

function convertHistory(history) {
  const messages = [new SystemMessage(nidhiPrompt)];

  for (const chat of history) {
    if (chat.role === "user") {
      messages.push(new HumanMessage(chat.content));
    } else if (chat.role === "assistant") {
      messages.push(new AIMessage(chat.content));
    }
  }

  return messages;
}

function normalizeImage(image) {
  if (typeof image === "string") {
    const match = image.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i
    );

    if (!match) {
      throw new Error(
        "Invalid image. Please upload a JPEG, PNG, or WebP image."
      );
    }

    const mimeType = match[1].toLowerCase();
    const base64 = match[2].replace(/\s/g, "");

    if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      throw new Error("Invalid Base64 image data.");
    }

    return { mimeType, base64 };
  }

  if (!image || typeof image !== "object") {
    throw new Error("Invalid image data received.");
  }

  const data = String(image.data || "");
  const mimeType = String(
    image.mimeType || image.mime_type || ""
  ).toLowerCase();

  if (data.startsWith("data:")) {
    return normalizeImage(data);
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, or WebP.");
  }

  const base64 = data.replace(/\s/g, "");

  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error("Image data is not valid Base64.");
  }

  return { mimeType, base64 };
}

function createUserMessage(message, images = []) {
  const text = String(message || "").trim();

  if (!text && images.length === 0) {
    throw new Error("Please enter a message or attach an image.");
  }

  if (images.length > 4) {
    throw new Error("You can upload a maximum of 4 images.");
  }

  if (images.length === 0) {
    return new HumanMessage(text);
  }

  const content = [];

  for (const image of images) {
    const normalized = normalizeImage(image);

    content.push({
      type: "image_url",
      image_url: `data:${normalized.mimeType};base64,${normalized.base64}`,
    });
  }

  content.push({
    type: "text",
    text:
      text ||
      "Please carefully analyze the attached image and explain what you see.",
  });

  return new HumanMessage({ content });
}

function getHistoryText(message) {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part) => part?.type === "text")
      .map((part) => part.text || "")
      .join("\n")
      .trim();

    const hasImage = message.content.some(
      (part) => part?.type === "image_url" || part?.type === "image"
    );

    if (hasImage) {
      return `${text}${text ? "\n" : ""}[Image attached]`;
    }

    return text || JSON.stringify(message.content);
  }

  return JSON.stringify(message.content ?? "");
}

function getResponseText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text")
      .map((part) => part.text || "")
      .join("\n");
  }

  return String(content ?? "");
}

async function chatNode(state) {
  const history = await loadHistory();
  const messages = convertHistory(history);

  const latestMessage = state.messages.at(-1);

  messages.push(latestMessage);

  const response = await model.invoke(messages);

  const userContent = getHistoryText(latestMessage);
  const assistantContent = getResponseText(response.content);

  history.push(
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent }
  );

  // Keep only the latest 100 history entries.
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }

  await saveHistory(history);

  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("chat", chatNode)
  .addEdge(START, "chat")
  .addEdge("chat", END);

const graph = workflow.compile();

export async function chatWithNidhi(message, images = []) {
  if (!Array.isArray(images)) {
    throw new Error("Images must be provided as an array.");
  }

  const userMessage = createUserMessage(message, images);

  const result = await graph.invoke({
    messages: [userMessage],
  });

  return getResponseText(result.messages.at(-1)?.content);
}

export default graph;