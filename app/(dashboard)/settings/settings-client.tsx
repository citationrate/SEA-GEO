"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Ticket, PlayCircle, LogOut, AlertTriangle, Check, Loader2, Trash2, Key, Send, Smartphone, Shield, Download, Camera, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { RestartTourButton } from "./restart-tour-button";
import { TwoFactorModal } from "@/components/two-factor-modal";
import { createClient as createAuthClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type SettingsTab = "account" | "voucher" | "supporto" | "privacy";

interface SettingsClientProps {
  userId: string;
  email: string;
  fullName: string;
  plan: string;
  notifyAnalysisComplete: boolean;
  avatarUrl?: string | null;
}

async function patchProfile(data: Record<string, unknown>) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export function SettingsClient({
  userId,
  email,
  fullName: initialName,
  plan,
  notifyAnalysisComplete: initialNotifyAnalysis,
  avatarUrl: initialAvatarUrl,
}: SettingsClientProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [fullName, setFullName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Voucher
  const [voucher, setVoucher] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Support form
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  // Privacy tab state
  const [consent, setConsent] = useState<Record<string, unknown> | null>(null);
  const [cookieAnalytics, setCookieAnalytics] = useState(false);
  const [cookieMarketing, setCookieMarketing] = useState(false);
  const [savingCookies, setSavingCookies] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // 2FA (TOTP via Supabase Auth)
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAFactorId, setTwoFAFactorId] = useState<string | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [twoFAModalOpen, setTwoFAModalOpen] = useState(false);

  // Load current MFA state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createAuthClient();
        const { data } = await sb.auth.mfa.listFactors();
        const verified = data?.totp?.find((f) => f.status === "verified");
        if (cancelled) return;
        if (verified) {
          setTwoFAEnabled(true);
          setTwoFAFactorId(verified.id);
        } else {
          setTwoFAEnabled(false);
          setTwoFAFactorId(null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setTwoFALoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTwoFAToggle() {
    if (twoFALoading) return;
    if (!twoFAEnabled) {
      // Turn ON → open enroll modal
      setTwoFAModalOpen(true);
      return;
    }
    // Turn OFF → confirm + unenroll
    const ok = window.confirm(
      t("settings.twoFactorDisableConfirm") ||
        "Sei sicuro di voler disattivare l'autenticazione a due fattori?",
    );
    if (!ok || !twoFAFactorId) return;
    setTwoFALoading(true);
    try {
      const sb = createAuthClient();
      const { error: unErr } = await sb.auth.mfa.unenroll({ factorId: twoFAFactorId });
      if (unErr) {
        alert(unErr.message);
        return;
      }
      setTwoFAEnabled(false);
      setTwoFAFactorId(null);
    } finally {
      setTwoFALoading(false);
    }
  }
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "") as SettingsTab;
      if (["account", "voucher", "supporto", "privacy"].includes(hash)) setActiveTab(hash);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const saveName = useCallback(async () => {
    setSavingName(true);
    setNameSaved(false);
    const ok = await patchProfile({ full_name: fullName });
    setSavingName(false);
    if (ok) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  }, [fullName]);

  async function redeemVoucher() {
    if (!voucher.trim()) return;
    setVoucherLoading(true);
    setVoucherMsg(null);
    try {
      const res = await fetch("/api/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucher.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setVoucherMsg({ ok: true, text: data.message || t("settings.voucherSuccess") });
        setVoucher("");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setVoucherMsg({ ok: false, text: data.error || t("settings.voucherInvalid") });
      }
    } catch {
      setVoucherMsg({ ok: false, text: t("settings.voucherError") });
    } finally {
      setVoucherLoading(false);
    }
  }

  async function sendSupportMessage() {
    if (!supportSubject.trim() || supportMessage.trim().length < 3) return;
    setSendingSupport(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: supportSubject.trim(), message: supportMessage.trim() }),
      });
      if (res.ok) {
        setSupportSubject("");
        setSupportMessage("");
        alert(t("settings.supportSent") || "Messaggio inviato! Ti risponderemo al più presto.");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || t("settings.supportError") || "Errore nell'invio");
      }
    } catch {
      alert(t("settings.supportError") || "Errore di rete");
    } finally {
      setSendingSupport(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (max 2 MB)");
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setAvatarUrl(data.avatar_url);
      toast.success(t("settings.avatarUploaded") || "Photo updated");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function handleAvatarRemove() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove avatar");
      setAvatarUrl(null);
      toast.success(t("settings.avatarRemoved") || "Photo removed");
    } catch {
      toast.error("Failed to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <>
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "account" as SettingsTab, label: "Account" },
          { key: "voucher" as SettingsTab, label: "Voucher" },
          { key: "supporto" as SettingsTab, label: t("settings.supportTab") || "Supporto" },
          { key: "privacy" as SettingsTab, label: t("settings.privacyTab") || "Privacy" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); window.location.hash = tab.key; }}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 whitespace-nowrap transition-all"
            style={{
              color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: activeTab === tab.key ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ ACCOUNT ═══ */}
      {activeTab === "account" && (<div className="space-y-4 animate-fade-in">
      {/* Profilo */}
      <div data-tour="settings-account" className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.profile")}</h2>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative group shrink-0">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id="avatar-upload"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <label
              htmlFor="avatar-upload"
              className="block cursor-pointer"
              title={t("settings.changeAvatar") || "Change photo"}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-14 h-14 rounded-full object-cover"
                  style={{ border: "2px solid var(--primary-hover)" }}
                />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-primary font-display text-xl" style={{ background: "var(--primary-glow)", border: "2px solid var(--primary-hover)" }}>
                  {(fullName?.[0] ?? email?.[0] ?? "U").toUpperCase()}
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.5)" }}>
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </label>
            {avatarUrl && !uploadingAvatar && (
              <button
                onClick={handleAvatarRemove}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title={t("settings.removeAvatar") || "Remove photo"}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-foreground font-medium">{fullName || email}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("settings.name")}</label>
            <div className="flex gap-2">
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-base flex-1" placeholder={t("settings.namePlaceholder")} />
              <button onClick={saveName} disabled={savingName || fullName === initialName} className="px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nameSaved ? <Check className="w-3.5 h-3.5" /> : null}
                {nameSaved ? t("common.saved") : t("common.save")}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("auth.email")}</label>
            <p className="text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2">{email}</p>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("settings.userId")}</label>
          <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2 font-mono text-xs truncate">{userId}</p>
        </div>
      </div>

      {/* Modifica password */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.changePassword") || "Modifica password"}</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("settings.changePasswordDesc") || "Riceverai un'email con il link per reimpostare la password."}</p>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/auth/reset-password", { method: "POST" });
                const data = await res.json();
                if (res.ok) alert(t("settings.resetSent") || "Email inviata! Controlla la tua casella.");
                else alert(data.error || t("settings.resetError") || "Errore nell'invio. Riprova.");
              } catch {
                alert(t("settings.resetError") || "Errore di rete. Riprova.");
              }
            }}
            className="px-4 py-2 border border-primary/40 text-primary rounded-[2px] text-sm font-medium hover:bg-primary/10 transition-colors shrink-0"
          >
            {t("settings.resetPassword") || "Reimposta password"}
          </button>
        </div>

        {/* 2FA via SMS */}
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <div className="flex items-start gap-3 min-w-0">
            <Smartphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("settings.twoFactorTitle") || "Autenticazione a due fattori (SMS)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings.twoFactorDesc") || "Aggiungi un livello di sicurezza extra al tuo account"}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={twoFAEnabled}
            aria-label={t("settings.twoFactorTitle") || "Autenticazione a due fattori"}
            onClick={handleTwoFAToggle}
            disabled={twoFALoading}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50 ${
              twoFAEnabled ? "bg-primary" : "bg-white/15"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                twoFAEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Sessione */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <LogOut className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.session")}</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <div>
            <p className="text-sm text-foreground">{t("settings.logoutDesc")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.logoutRedirect")}</p>
          </div>
          <button
            onClick={async () => {
              setLoggingOut(true);
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
            }}
            disabled={loggingOut}
            className="px-4 py-2 border border-border text-foreground rounded-[2px] text-sm font-medium hover:bg-muted/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {loggingOut ? t("common.loggingOut") : t("common.logout")}
          </button>
        </div>
      </div>

      {/* Zona pericolo */}
      <div className="card p-6 space-y-4 border-destructive/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-display font-semibold text-destructive">{t("settings.dangerZone")}</h2>
        </div>
        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div className="flex items-center gap-3">
            <Trash2 className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">{t("settings.deletedProjects")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.restoreDeleted")}</p>
            </div>
          </div>
          <a href="/settings/deleted-projects" className="px-4 py-2 border border-destructive/30 text-destructive rounded-[2px] text-sm font-medium hover:bg-destructive/10 transition-colors shrink-0">{t("common.manage")}</a>
        </div>
        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">{t("settings.deleteAccount")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.deleteWarning")}</p>
            </div>
          </div>
          {!showDeleteAccount ? (
            <button onClick={() => setShowDeleteAccount(true)} className="px-4 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium hover:bg-destructive/80 transition-colors shrink-0">{t("common.delete")}</button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowDeleteAccount(false)} className="px-3 py-2 border border-border text-foreground rounded-[2px] text-sm hover:bg-muted/30 transition-colors">{t("common.cancel")}</button>
              <button className="px-3 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium opacity-50 cursor-not-allowed" disabled title={t("settings.comingSoon")}>{t("common.confirm")}</button>
            </div>
          )}
        </div>
      </div>
      </div>)}

      {/* ═══ VOUCHER ═══ */}
      {activeTab === "voucher" && (
        <div className="space-y-4 animate-fade-in">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-foreground">{t("settings.redeemVoucher")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.voucherDesc")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucher}
                onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && redeemVoucher()}
                placeholder={t("settings.voucherPlaceholder")}
                className="input-base flex-1 font-mono uppercase tracking-wider"
              />
              <button
                onClick={redeemVoucher}
                disabled={voucherLoading || !voucher.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {voucherLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                {t("settings.redeemVoucher")}
              </button>
            </div>
            {voucherMsg && (
              <p className={`text-sm ${voucherMsg.ok ? "text-primary" : "text-destructive"}`}>{voucherMsg.text}</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ SUPPORTO ═══ */}
      {activeTab === "supporto" && (
        <div className="space-y-4 animate-fade-in">
          {/* Contact form */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-foreground">{t("settings.contactSupport") || "Contatta il supporto"}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.contactSupportDesc") || "Hai bisogno di aiuto? Compila il form e ti risponderemo al più presto."}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">{t("settings.supportSubject") || "Oggetto"}</label>
                <input
                  type="text"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder={t("settings.supportSubjectPlaceholder") || "Es: Bug, Domanda, Feedback..."}
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">{t("settings.supportMessage") || "Messaggio"}</label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder={t("settings.supportMessagePlaceholder") || "Descrivi il tuo problema o la tua richiesta..."}
                  rows={5}
                  className="input-base w-full resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{t("settings.supportFrom") || "Da:"} {email}</p>
                <button
                  onClick={sendSupportMessage}
                  disabled={sendingSupport || !supportSubject.trim() || supportMessage.trim().length < 3}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {sendingSupport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingSupport ? (t("common.sending") || "Invio...") : (t("settings.sendMessage") || "Invia messaggio")}
                </button>
              </div>
            </div>
          </div>

          {/* Tour guidato */}
          <div data-tour="settings-tour" className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <PlayCircle className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-foreground">{t("settings.guidedTour")}</h2>
            </div>
            <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
              <p className="text-sm text-muted-foreground">{t("settings.reviewTour")}</p>
              <RestartTourButton />
            </div>
          </div>
        </div>
      )}

      {/* ═══ PRIVACY ═══ */}
      {activeTab === "privacy" && (
        <PrivacyTab
          consent={consent}
          setConsent={setConsent}
          cookieAnalytics={cookieAnalytics}
          setCookieAnalytics={setCookieAnalytics}
          cookieMarketing={cookieMarketing}
          setCookieMarketing={setCookieMarketing}
          savingCookies={savingCookies}
          setSavingCookies={setSavingCookies}
          exportingData={exportingData}
          setExportingData={setExportingData}
        />
      )}

      <TwoFactorModal
        open={twoFAModalOpen}
        onClose={() => setTwoFAModalOpen(false)}
        onEnrolled={(id) => {
          setTwoFAEnabled(true);
          setTwoFAFactorId(id);
        }}
      />
    </>
  );
}

/* ─── helpers for CitationRate backend calls ─── */

const CR_BACKEND =
  process.env.NEXT_PUBLIC_CR_BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "https://citationrate-backend-production.up.railway.app");

async function crFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${CR_BACKEND}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ─── Privacy Tab component ─── */

const LEGAL_BASE = "https://suite.citationrate.com/legal/avi";

function PrivacyTab({
  consent, setConsent,
  cookieAnalytics, setCookieAnalytics,
  cookieMarketing, setCookieMarketing,
  savingCookies, setSavingCookies,
  exportingData, setExportingData,
}: {
  consent: Record<string, unknown> | null;
  setConsent: (c: Record<string, unknown> | null) => void;
  cookieAnalytics: boolean; setCookieAnalytics: (v: boolean) => void;
  cookieMarketing: boolean; setCookieMarketing: (v: boolean) => void;
  savingCookies: boolean; setSavingCookies: (v: boolean) => void;
  exportingData: boolean; setExportingData: (v: boolean) => void;
}) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "it-IT";

  // Load consent on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createAuthClient();
        const { data: { session } } = await sb.auth.getSession();
        if (!session || cancelled) return;
        const data = await crFetch("/consent", session.access_token);
        if (cancelled) return;
        setConsent(data);
        const prefs = (data?.cookie_preferences as { analytics?: boolean; marketing?: boolean }) || {};
        setCookieAnalytics(!!prefs.analytics);
        setCookieMarketing(!!prefs.marketing);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCookiePrefs = async () => {
    setSavingCookies(true);
    try {
      const sb = createAuthClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      await crFetch("/consent/cookies", session.access_token, {
        method: "PUT",
        body: JSON.stringify({ analytics: cookieAnalytics, marketing: cookieMarketing }),
      });
      const prefs = { necessary: true, analytics: cookieAnalytics, marketing: cookieMarketing };
      localStorage.setItem("cookie_consent", JSON.stringify(prefs));
      toast.success(t("settingsPrivacy.cookiePrefsSaved"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSavingCookies(false);
    }
  };

  const handleExport = async () => {
    setExportingData(true);
    try {
      const sb = createAuthClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const data = await crFetch("/me/export", session.access_token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avi_data_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settingsPrivacy.exportSuccess"));
    } catch {
      toast.error(t("settingsPrivacy.exportError"));
    } finally {
      setExportingData(false);
    }
  };

  const fmtDate = (d: unknown) =>
    d ? new Date(d as string).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Cookie Preferences */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settingsPrivacy.cookiePrefs")}</h2>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm text-foreground">{t("cookie.necessary")}</span>
              <p className="text-xs text-muted-foreground">{t("cookie.necessaryDesc")}</p>
            </div>
            <input type="checkbox" checked disabled className="accent-primary" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-foreground">{t("cookie.analytics")}</span>
              <p className="text-xs text-muted-foreground">{t("cookie.analyticsDesc")}</p>
            </div>
            <input type="checkbox" checked={cookieAnalytics} onChange={e => setCookieAnalytics(e.target.checked)} className="accent-primary" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-foreground">{t("cookie.marketing")}</span>
              <p className="text-xs text-muted-foreground">{t("cookie.marketingDesc")}</p>
            </div>
            <input type="checkbox" checked={cookieMarketing} onChange={e => setCookieMarketing(e.target.checked)} className="accent-primary" />
          </label>
          <button
            onClick={saveCookiePrefs}
            disabled={savingCookies}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5 mt-2"
          >
            {savingCookies ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {savingCookies ? "..." : t("cookie.save")}
          </button>
        </div>
      </div>

      {/* Legal Documents */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settingsPrivacy.legalDocs")}</h2>
        </div>
        <div className="space-y-2">
          {[
            { href: `${LEGAL_BASE}/privacy`, label: t("legal.privacy") },
            { href: `${LEGAL_BASE}/terms`, label: t("legal.terms") },
            { href: `${LEGAL_BASE}/cookies`, label: t("legal.cookies") },
          ].map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline transition-colors">
              {l.label} →
            </a>
          ))}
        </div>
      </div>

      {/* Consent History */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settingsPrivacy.consentHistory")}</h2>
        </div>
        {consent ? (
          <div className="space-y-2">
            {[
              { label: t("settingsPrivacy.tosAccepted"), date: consent.tos_accepted_at },
              { label: t("settingsPrivacy.privacyAccepted"), date: consent.privacy_accepted_at },
              { label: t("settingsPrivacy.cookieAccepted"), date: consent.cookie_consent_at },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">{item.label}</span>
                <span className="text-xs" style={{ color: item.date ? "var(--foreground)" : "var(--muted-foreground)" }}>
                  {fmtDate(item.date) || t("settingsPrivacy.notAccepted")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">...</p>
        )}
      </div>

      {/* Data Export */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settingsPrivacy.exportData")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("settingsPrivacy.exportDesc")}</p>
        <button
          onClick={handleExport}
          disabled={exportingData}
          className="px-4 py-2 border border-primary/40 text-primary rounded-[2px] text-sm font-medium hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {exportingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exportingData ? t("settingsPrivacy.exporting") : t("settingsPrivacy.download")}
        </button>
      </div>
    </div>
  );
}
