/** Public base URL of the app, used for invite links, share cards and badge metadata. */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const squadUrl = (id: number) => `${appUrl()}/squad/${id}`;
export const profileUrl = (address: string) => `${appUrl()}/u/${address}`;

export function shareLinks(text: string, url: string) {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return {
    x: `https://x.com/intent/post?text=${t}&url=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
  };
}
