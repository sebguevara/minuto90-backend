import { minutoPrismaClient } from "../../../lib/minuto-client";

export type EvolutionInstanceConfig = {
  id?: string;
  instanceName: string;
  baseUrl: string;
  apiKey: string;
};

const DEFAULT_EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:9090";

const shouldUseJid = () =>
  (process.env.EVOLUTION_USE_JID ?? "false").toLowerCase() === "true";

const ARGENTINA_DIAL_CODE = "54";

/**
 * Argentina admite el "9" del mobile internacional y el "0" del trunk domestico
 * justo despues del codigo de pais. Los colapsamos a `54<area><numero>` para
 * deduplicar (`5493794619729`, `5403794619729` y `543794619729` son el mismo).
 */
export function normalizeArgentinaPhone(digits: string): string {
  if (!digits.startsWith(ARGENTINA_DIAL_CODE)) return digits;
  let rest = digits.slice(ARGENTINA_DIAL_CODE.length);
  while (rest.length > 0 && (rest[0] === "9" || rest[0] === "0")) {
    rest = rest.slice(1);
  }
  return ARGENTINA_DIAL_CODE + rest;
}

export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) throw new Error("Invalid phone number");
  return normalizeArgentinaPhone(digits);
}

export function toEvolutionNumber(raw: string): string {
  const cleaned = raw.includes("@") ? raw : normalizePhoneNumber(raw);
  if (cleaned.includes("@")) return cleaned;
  return shouldUseJid() ? `${cleaned}@s.whatsapp.net` : cleaned;
}

export async function getActiveEvolutionInstances(): Promise<EvolutionInstanceConfig[]> {
  const fromEnv = {
    instanceName: process.env.EVOLUTION_INSTANCE_NAME,
    apiKey: process.env.EVOLUTION_API_KEY,
  };

  if (fromEnv.instanceName && fromEnv.apiKey) {
    return [
      {
        instanceName: fromEnv.instanceName,
        apiKey: fromEnv.apiKey,
        baseUrl: DEFAULT_EVOLUTION_BASE_URL,
      },
    ];
  }

  const rows = await minutoPrismaClient.evolutionInstance.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!rows.length) {
    throw new Error(
      "No active EvolutionInstance found (set EVOLUTION_INSTANCE_NAME + EVOLUTION_API_KEY or create EvolutionInstance row)."
    );
  }

  return rows.map((row) => ({
    id: row.id,
    instanceName: row.instanceName,
    baseUrl: row.baseUrl || DEFAULT_EVOLUTION_BASE_URL,
    apiKey: row.apiKey,
  }));
}

export class EvolutionApiClient {
  async sendText(input: { number: string; text: string; instance?: EvolutionInstanceConfig }) {
    const instanceList = input.instance ? [input.instance] : await getActiveEvolutionInstances();
    const instance = instanceList[0];
    const url = `${instance.baseUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(
      instance.instanceName
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: instance.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: toEvolutionNumber(input.number),
        text: input.text,
        linkPreview: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Evolution sendText error: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`
      );
    }

    return res.json().catch(() => null);
  }
}

export const evolutionApiClient = new EvolutionApiClient();
