import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";

export const maxDuration = 60;

const FULL_SYSTEM_PROMPT = `You are the world's most advanced AI Image Prompt Engineer specializing in reverse-engineering photographs into ULTRA-LONG, HYPER-EXPANSIVE, SUPER-DETAILED masterwork text-to-image prompts for Midjourney v6.1, FLUX.1, and SDXL.

YOUR GOAL: Produce an INSANELY DETAILED, LONG, AND EXHAUSTIVE prompt (300-500 words). Do NOT summarize or condense. Describe EVERY SINGLE VISUAL DETAIL in vivid, granular language.

CRITICAL INSTRUCTION ON USER DIRECTIVES:
If a custom subject instruction is provided in Indonesian or English (e.g., "deskripsikan hanya laki lakinya saja tanpa ada deskripsi perempuan"), execute that directive DIRECTLY in English.
NEVER write meta-commentary, system notes, or meta-phrases like "translated instruction embedded:", "user requested:", "override:", or "custom instruction:". Output ONLY the prompt description itself.

OUTPUT FORMAT (comma-separated, single continuous text without headers, numbers, or section labels):
Start directly describing the core subject (incorporating any custom instruction seamlessly), then environment, foliage, fog, architecture, photography style, lighting setup, color palette, camera body and lens specs, and high-fidelity rendering keywords.

CRITICAL RULE: Return ONLY the final comma-separated prompt string in English, ready to copy-paste. No headers, labels, numbers, meta-phrases, or introductory text. Make it EXTREMELY DETAILED and LONG.`;

const STYLE_ONLY_SYSTEM_PROMPT = `You are an elite AI Photography & Aesthetic Style Transfer Prompt Engineer specializing in reverse-engineering image aesthetics into ULTRA-LONG, HYPER-EXPANSIVE, SUPER-DETAILED text-to-image prompts for Midjourney v6.1, FLUX.1, and SDXL.

YOUR GOAL: Produce an INSANELY DETAILED, LONG, AND EXHAUSTIVE prompt (300-500 words) capturing ONLY the photography style, camera angle, lighting, environment, and color palette.

STRICT MANDATORY RULE FOR STYLE ONLY MODE:
DO NOT DESCRIBE OR MENTION THE PERSON, PEOPLE, HUMAN SUBJECT, FACES, HAIR, GENDER, OR CLOTHING IN THE PHOTO AT ALL.
Do NOT mention "woman", "man", "person", "people", "couple", "face", "hair", "jacket", "clothing", "male", or "female".
Focus 100% EXCLUSIVELY on camera angle, framing, background landscape, fog, architecture, lighting setup, color palette, optics, and photography style.
NEVER write meta-commentary, system notes, or meta-phrases like "Analysis mode:", "Style only mode:", or "system note:". Output ONLY the photography style description itself.

OUTPUT FORMAT (comma-separated, single continuous text without headers, numbers, or section labels):
Start directly describing the camera angle, framing, environment, background landscape, fog density, trees, foliage, photography style, lighting setup, color palette, camera body, lens optics, and rendering quality keywords.

CRITICAL RULE: Return ONLY the final comma-separated prompt string in English, ready to copy-paste. No headers, labels, numbers, meta-phrases, or mention of any human subjects. Make it EXTREMELY DETAILED and LONG.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      imageBase64,
      analysisMode = "full",
      customInstruction,
    } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid imageBase64 payload" },
        { status: 400 }
      );
    }

    let activeModel = "gpt-4o-mini";
    let dbOpenaiKey = process.env.OPENAI_API_KEY;

    try {
      const dbSettings = await db.select().from(systemSettings);
      for (const item of dbSettings) {
        if (item.key === "active_model" && item.value) {
          activeModel = item.value;
        }
        if (
          item.key === "openai_key" &&
          item.value?.trim() &&
          !item.value.includes("your-openai-api-key")
        ) {
          dbOpenaiKey = item.value.trim();
        }
      }
    } catch (e) {
      console.warn("[IMAGE_ANALYZER] Using default settings:", e);
    }

    if (!dbOpenaiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is missing. Please configure it in Settings or environment variables." },
        { status: 401 }
      );
    }

    const customOpenAI = createOpenAI({
      apiKey: dbOpenaiKey,
    });

    const isStyleOnly = analysisMode === "style_only";
    const chosenSystemPrompt = isStyleOnly ? STYLE_ONLY_SYSTEM_PROMPT : FULL_SYSTEM_PROMPT;

    let userMessageText = "";

    if (isStyleOnly) {
      userMessageText = "Analyze this image and generate an insanely detailed 300-500 word prompt capturing ONLY the camera angle, environment, fog, background, lighting setup, color palette, lens optics, and photography style. Strictly do not describe any people, faces, or clothing.";
    } else {
      userMessageText = "Analyze this image and generate an insanely detailed 300-500 word text-to-image prompt covering every micro-detail, clothing pattern, lighting ray, environment, and camera spec.";
      if (customInstruction?.trim()) {
        userMessageText += `\nSubject Directive: ${customInstruction.trim()}`;
      }
    }

    const result = await generateText({
      model: customOpenAI(activeModel as any),
      system: chosenSystemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userMessageText,
            },
            {
              type: "image",
              image: imageBase64,
            },
          ],
        },
      ],
    });

    return NextResponse.json({ prompt: result.text.trim() });
  } catch (error: any) {
    console.error("[IMAGE_ANALYZER_ERROR]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to analyze image" },
      { status: 500 }
    );
  }
}
