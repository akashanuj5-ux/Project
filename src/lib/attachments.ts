import { apiFetch, apiFetchBlob } from "@/lib/api";

/**
 * Ticket attachment helpers (files are stored in MySQL via Express —
 * there is no external storage dependency).
 *
 * Stored reference format: deviations.eco_attachment_url = "/api/attachments/<id>".
 * Legacy tickets may still hold inline "data:<mime>;base64,..." values.
 */

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export interface StoredAttachment {
  id: string;
  deviation_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  /** Relative Express API path, e.g. "/api/attachments/<id>". */
  url: string;
}

/** True when the stored reference points at the local Express attachment API. */
export function isApiAttachmentUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("/api/attachments/");
}

/** Extract the attachment id from a stored "/api/attachments/<id>" reference. */
export function attachmentIdFromUrl(url: string): string | null {
  if (!isApiAttachmentUrl(url)) return null;
  const id = url.slice("/api/attachments/".length).split("?")[0];
  return id || null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma === -1 ? "" : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read attachment"));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads the file to Express/MySQL and resolves ONLY after the backend has
 * confirmed storage (201 + stored metadata). Callers must await this before
 * completing the approval/save so the ticket never references a missing file.
 */
export async function uploadDeviationAttachment(
  deviationId: string,
  file: File,
): Promise<StoredAttachment> {
  const contentBase64 = await fileToBase64(file);
  return apiFetch<StoredAttachment>(`/api/deviations/${deviationId}/attachments`, {
    method: "POST",
    body: JSON.stringify({
      file_name: file.name,
      mime_type: file.type,
      content_base64: contentBase64,
    }),
  });
}

/** Best-effort removal of a just-uploaded file when the save afterwards fails. */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  await apiFetch<void>(`/api/attachments/${attachmentId}`, { method: "DELETE" });
}

/** Parsed legacy inline data URL. */
export interface ParsedDataUrl {
  blob: Blob;
  mime: string;
}

/** Decodes a "data:<mime>;base64,..." value into a Blob (legacy tickets). */
export function parseDataUrl(url: string): ParsedDataUrl | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!match) return null;
  const mime = (match[1] ?? "").toLowerCase();
  if (!mime) return null;
  if (match[2]) {
    const binary = atob(match[3] ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { blob: new Blob([bytes], { type: mime }), mime };
  }
  return { blob: new Blob([decodeURIComponent(match[3] ?? "")], { type: mime }), mime };
}

/** Pulls the original filename out of a Content-Disposition header. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch && utfMatch[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      /* fall through to the plain filename */
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch && plainMatch[1] ? plainMatch[1] : null;
}

export interface AttachmentContent {
  blob: Blob;
  mime: string;
  fileName: string | null;
}

/**
 * Fetches the original bytes of a stored attachment reference.
 * - "/api/attachments/<id>" → authenticated Express/MySQL fetch (correct MIME)
 * - "data:..."              → legacy inline attachment decoded locally
 * Returns null for anything else (external URLs are never fetched).
 */
export async function fetchAttachmentContent(url: string): Promise<AttachmentContent | null> {
  if (isApiAttachmentUrl(url)) {
    const { blob, headers } = await apiFetchBlob(url);
    const fileName = fileNameFromDisposition(headers.get("content-disposition"));
    return { blob, mime: blob.type || headers.get("content-type") || "", fileName };
  }
  if (url.startsWith("data:")) {
    const parsed = parseDataUrl(url);
    if (!parsed) return null;
    return { blob: parsed.blob, mime: parsed.mime, fileName: null };
  }
  return null;
}

/** Triggers a browser download of the given bytes under the original name. */
export function saveBlobAs(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Sensible fallback name when the source did not provide one. */
export function fallbackFileName(mime: string): string {
  if (mime === "image/png") return "attachment.png";
  if (mime === "image/jpeg") return "attachment.jpg";
  if (mime === "application/pdf") return "attachment.pdf";
  return "attachment";
}
