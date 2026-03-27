"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Ticket, Bell, PlayCircle, LogOut, AlertTriangle, Check, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { RestartTourButton } from "./restart-tour-button";

interface SettingsClientProps {
  userId: string;
  email: string;
  fullName: string;
  plan: string;
  notifyAnalysisComplete: boolean;
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
}: SettingsClientProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [fullName, setFullName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [notifyAnalysis, setNotifyAnalysis] = useState(initialNotifyAnalysis);

  // Voucher
  const [voucher, setVoucher] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

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

  const toggleNotification = useCallback(async (field: string, value: boolean) => {
    if (field === "notify_analysis_complete") setNotifyAnalysis(value);
    await patchProfile({ [field]: value });
  }, []);

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

  return (
    <>
      {/* 1. Profilo */}
      <div data-tour="settings-account" className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.profile")}</h2>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-[2px] flex items-center justify-center text-primary font-display text-xl shrink-0" style={{ background: "var(--primary-glow)", border: "1px solid var(--primary-hover)" }}>
            {(fullName?.[0] ?? email?.[0] ?? "U").toUpperCase()}
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
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-base flex-1"
                placeholder={t("settings.namePlaceholder")}
              />
              <button
                onClick={saveName}
                disabled={savingName || fullName === initialName}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
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

      {/* 2. Voucher */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Voucher</h2>
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

      {/* 4. Notifiche */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.notifications")}</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
            <div>
              <p className="text-sm text-foreground">{t("settings.emailOnComplete")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.receiveNotification")}</p>
            </div>
            <button
              onClick={() => toggleNotification("notify_analysis_complete", !notifyAnalysis)}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifyAnalysis ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifyAnalysis ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Tour guidato */}
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

      {/* 6. Sessione */}
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

      {/* 7. Zona pericolo */}
      <div className="card p-6 space-y-4 border-destructive/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-display font-semibold text-destructive">{t("settings.dangerZone")}</h2>
        </div>

        {/* Elimina progetti */}
        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div className="flex items-center gap-3">
            <Trash2 className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">{t("settings.deletedProjects")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.restoreDeleted")}</p>
            </div>
          </div>
          <a
            href="/settings/deleted-projects"
            className="px-4 py-2 border border-destructive/30 text-destructive rounded-[2px] text-sm font-medium hover:bg-destructive/10 transition-colors shrink-0"
          >
            {t("common.manage")}
          </a>
        </div>

        {/* Elimina account */}
        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">{t("settings.deleteAccount")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.deleteWarning")}</p>
            </div>
          </div>
          {!showDeleteAccount ? (
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="px-4 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium hover:bg-destructive/80 transition-colors shrink-0"
            >
              {t("common.delete")}
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteAccount(false)}
                className="px-3 py-2 border border-border text-foreground rounded-[2px] text-sm hover:bg-muted/30 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                className="px-3 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium opacity-50 cursor-not-allowed"
                disabled
                title={t("settings.comingSoon")}
              >
                {t("common.confirm")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
