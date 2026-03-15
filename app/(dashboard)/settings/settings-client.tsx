"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, CreditCard, Bell, AlertTriangle, Check, Loader2, LogOut } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

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
  const [fullName, setFullName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [notifyAnalysis, setNotifyAnalysis] = useState(initialNotifyAnalysis);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const isPro = plan === "pro" || plan === "agency";

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

  return (
    <>
      {/* Profilo */}
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

      {/* Piano Abbonamento */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.subscription")}</h2>
        </div>

        <div className="flex items-center gap-3 mb-3">
          {isPro ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-[2px] bg-primary/10 border border-primary/30 text-primary">
              <Check className="w-4 h-4" />
              {t("settings.proActive")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-[2px] bg-muted/30 border border-border text-foreground">
              {t("settings.basePlan")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-muted/20 rounded-[2px] p-4 space-y-2 border border-border">
            <p className="font-semibold text-foreground text-sm">{t("settings.baseStarter")}</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>100 {t("settings.queriesMonth")}</li>
              <li>{t("settings.maxProjects").replace("{n}", "3")}</li>
              <li>{t("settings.maxModels").replace("{n}", "3")}</li>
              <li>{t("settings.basicAvi")}</li>
            </ul>
          </div>
          <div className="bg-primary/5 rounded-[2px] p-4 space-y-2 border border-primary/20">
            <p className="font-semibold text-primary text-sm">Pro</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>500 {t("settings.queriesMonth")}</li>
              <li>{t("settings.maxProjects").replace("{n}", "10")}</li>
              <li>{t("settings.allModelsUnlocked")}</li>
              <li>10 {t("settings.compareDetections")}</li>
              <li>{t("settings.generatePromptAI")}</li>
              <li>{t("settings.datasetUnlocked")}</li>
              <li>{t("settings.fullAvi")}</li>
            </ul>
          </div>
        </div>

        {!isPro && (
          <button className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold opacity-50 cursor-not-allowed" disabled>
            {t("settings.upgradeProSoon")}
          </button>
        )}
      </div>

      {/* Notifiche */}
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
              className={`relative w-10 h-5 rounded-full transition-colors ${notifyAnalysis ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${notifyAnalysis ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Logout */}
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

      {/* Danger Zone */}
      <div className="card p-6 space-y-4 border-destructive/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-display font-semibold text-destructive">{t("settings.dangerZone")}</h2>
        </div>

        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div>
            <p className="text-sm text-foreground font-medium">{t("settings.deleteAccount")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.deleteWarning")}</p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium hover:bg-destructive/80 transition-colors shrink-0"
            >
              {t("common.delete")}
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(false)}
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
