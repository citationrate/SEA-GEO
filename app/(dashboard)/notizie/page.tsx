import { AiNewsPanel } from "@/components/ai-news-panel";

export const metadata = { title: "Notizie AI" };

export default function NotiziePage() {
  return (
    <div className="max-w-[900px] space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>
          Notizie AI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggiornamenti dai provider AI — modelli, API, comportamenti e novità rilevanti per la tua visibilità.
        </p>
      </div>

      <AiNewsPanel />
    </div>
  );
}
