import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "seageo",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://sea-geo-made-by-claude.vercel.app",
});
