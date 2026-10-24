
import express from "express";
import { chatWithNidhi } from "../agent.js";

const router = express.Router();

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_SIGNATURES = [
  {
    type: "jpeg",
    check: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    type: "png",
    check: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      ),
  },
  {
    type: "webp",
    check: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP",
  },
];

function validateImage(image) {
  if (typeof image !== "string") {
    throw new Error("Invalid image format.");
  }

  const match = image.match(
    /^(?:data:image\/(?:jpeg|jpg|png|webp);base64,)?([A-Za-z0-9+/]+={0,2})$/
  );

  if (!match) {
    throw new Error("Upload a valid JPEG, PNG, or WebP image.");
  }

  const base64 = match[1];
  const buffer = Buffer.from(base64, "base64");

  if (
    !buffer.length ||
    buffer.length > MAX_IMAGE_BYTES ||
    buffer.toString("base64").replace(/=+$/, "") !==
      base64.replace(/=+$/, "")
  ) {
    throw new Error("Each image must be smaller than 5 MB.");
  }

  const detected = ALLOWED_SIGNATURES.find(({ check }) =>
    check(buffer)
  );

  if (!detected) {
    throw new Error("The uploaded file is not a supported image.");
  }

  return {
    data: buffer.toString("base64"),
    mimeType: `image/${detected.type}`,
  };
}

router.post("/", async (req, res) => {
  try {
    const { message = "", images = [] } = req.body ?? {};

    if (typeof message !== "string" || message.length > 12000) {
      return res.status(400).json({
        success: false,
        message: "Message must be a string under 12,000 characters.",
      });
    }

    if (!Array.isArray(images) || images.length > MAX_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `Upload a maximum of ${MAX_IMAGES} images at once.`,
      });
    }

    if (!message.trim() && images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Write a message or upload an image.",
      });
    }

    const validatedImages = images.map(validateImage);

    // Existing agent receives text plus optional image data.
    const reply = await chatWithNidhi(message.trim(), validatedImages);

    return res.json({
      success: true,
      reply,
      imageAnalyzed: validatedImages.length > 0,
    });
  } catch (error) {
    console.error("[Nidhi Chat Error]", error.message);

    const clientError = [
      "Invalid image format.",
      "Upload a valid JPEG, PNG, or WebP image.",
      "Each image must be smaller than 5 MB.",
      "The uploaded file is not a supported image.",
    ].includes(error.message);

    return res.status(clientError ? 400 : 500).json({
      success: false,
      message: clientError
        ? error.message
        : "Nidhi could not respond. Please try again.",
    });
  }
});

export default router;
