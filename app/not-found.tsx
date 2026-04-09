import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <p className="font-mono text-6xl font-bold text-primary">404</p>
      <div className="space-y-2 max-w-md">
        <h2 className="font-display text-xl font-bold">
          Pagina non trovata
        </h2>
        <p className="text-sm text-muted-foreground">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors"
      >
        Torna alla dashboard
      </Link>
    </div>
  );
}
