/**
 * Skeleton mostrato istantaneamente da Next.js mentre il server component
 * della pagina BP corrente esegue SSR + auth + DB fetches. Senza questo file
 * l'utente vedeva una pagina bianca / la pagina precedente fino al primo
 * paint del nuovo SSR (50-2000ms a seconda del DB e del cold start).
 *
 * È volutamente generico (header + 3 card di placeholder) per coprire tutte
 * le sottoroute /brand-profile/* — non vale lo sforzo di skeleton mirati
 * per ogni pagina; l'obiettivo è "qualcosa al primo frame".
 */
export default function BrandProfileLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-[2px] bg-surface-2" />
        <div className="h-8 w-64 rounded-[2px] bg-surface-2" />
        <div className="h-4 w-80 rounded-[2px] bg-surface-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2 h-[360px] flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-surface-2" />
        </div>
        <div className="card p-6 space-y-4">
          <div className="h-3 w-32 bg-surface-2 rounded-[2px]" />
          <div className="h-16 w-24 bg-surface-2 rounded-[2px]" />
          <div className="space-y-2 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-6 w-full bg-surface-2 rounded-[2px]" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-5 w-32 bg-surface-2 rounded-[2px]" />
            <div className="h-4 w-full bg-surface-2 rounded-[2px]" />
            <div className="h-4 w-3/4 bg-surface-2 rounded-[2px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
