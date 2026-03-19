import OpenAI from "openai";

// Uses process.env.OPENAI_API_KEY by default
export const openai = new OpenAI();

export type OpenAIClientContract = typeof openai;
