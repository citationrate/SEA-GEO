export default function SaleTermsText() {
  const h = { color: "var(--primary)", fontWeight: 600 as const, marginTop: 16, marginBottom: 6, fontSize: 13 };
  const p = { marginBottom: 10 };

  return (
    <div>
      <p style={p}>
        Le presenti Condizioni Generali di Vendita regolano l&apos;acquisto dei servizi digitali
        offerti da <strong>SDB srl</strong> attraverso la piattaforma AVI (avi.citationrate.com)
        e Citability Score (suite.citationrate.com).
      </p>

      <p style={h}>1. Piani e Prezzi</p>
      <p style={p}>
        <strong>Base:</strong> &euro;59/mese &mdash; 100 prompt, 30 con browsing, 6 modelli AI selezionabili.<br/>
        <strong>Pro:</strong> &euro;159/mese &mdash; 300 prompt, 90 con browsing, tutti i modelli + 10 confronti competitivi/mese.<br/>
        Pacchetti extra: query 100 (&euro;19/29), query 300 (&euro;49/89), confronti 3/5/10 (&euro;15/19/25).
      </p>

      <p style={h}>2. Pagamento</p>
      <p style={p}>
        I pagamenti sono gestiti tramite Stripe. Accettiamo carte di credito e debito dei principali
        circuiti internazionali. Il servizio viene attivato immediatamente dopo la conferma del pagamento.
      </p>

      <p style={h}>3. Rinnovo Automatico</p>
      <p style={p}>
        Gli abbonamenti si rinnovano automaticamente alla scadenza del periodo di fatturazione (mensile o annuale).
        Puoi cancellare l&apos;abbonamento in qualsiasi momento dal portale di fatturazione Stripe,
        accessibile dalla sezione Piano. La cancellazione ha effetto alla fine del periodo in corso.
      </p>

      <p style={h}>4. Diritto di Recesso</p>
      <p style={p}>
        Ai sensi del D.Lgs. 206/2005 (Codice del Consumo), hai diritto di recedere entro 14 giorni
        dalla sottoscrizione senza alcuna penale. Il recesso puo&apos; essere esercitato inviando
        comunicazione a <span style={{ color: "var(--primary)" }}>info@citationrate.com</span>.
        Il diritto di recesso e&apos; escluso se hai gia&apos; utilizzato il servizio con il tuo
        consenso espresso prima della scadenza del periodo di recesso.
      </p>

      <p style={h}>5. Rimborsi</p>
      <p style={p}>
        I rimborsi vengono elaborati entro 14 giorni lavorativi tramite lo stesso metodo di pagamento
        utilizzato per l&apos;acquisto.
      </p>

      <p style={h}>6. Modifiche ai Prezzi</p>
      <p style={p}>
        SDB srl si riserva il diritto di modificare i prezzi con un preavviso di almeno 30 giorni.
        Le modifiche non si applicano al periodo di fatturazione in corso.
      </p>

      <p style={h}>7. Limitazione di Responsabilita&apos;</p>
      <p style={p}>
        I risultati forniti dalla piattaforma hanno carattere indicativo e non costituiscono garanzia
        di visibilita&apos; o posizionamento nelle risposte generate dall&apos;intelligenza artificiale.
        SDB srl non sara&apos; responsabile per danni indiretti derivanti dall&apos;uso del servizio.
      </p>

      <p style={h}>8. Legge Applicabile</p>
      <p style={p}>
        Le presenti condizioni sono regolate dalla legge italiana. Per qualsiasi controversia sara&apos;
        competente il Foro del luogo di residenza del consumatore, ove applicabile, o in via
        residuale il Foro di Milano.
      </p>

      <div style={{ background: "rgba(122,184,154,0.08)", border: "1px solid rgba(122,184,154,0.2)", borderRadius: 4, padding: "12px 14px", marginTop: 16 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>
          Diritto di recesso / Right of withdrawal
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--foreground)", lineHeight: 1.6 }}>
          Hai 14 giorni per recedere dall&apos;acquisto senza penali (D.Lgs. 206/2005, art. 52).
          You have 14 days to withdraw from this purchase without penalty (EU Consumer Rights Directive).
        </p>
      </div>

      <p style={{ ...p, fontSize: 11, color: "var(--muted-foreground)", marginTop: 16 }}>
        Versione 1.0 &mdash; Ultimo aggiornamento: 14 aprile 2026.
      </p>
    </div>
  );
}
