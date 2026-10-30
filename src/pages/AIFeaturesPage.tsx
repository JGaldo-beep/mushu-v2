import { Languages, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/GlassCard";
import { GlassSelect } from "@/components/GlassSelect";
import { GlassToggle } from "@/components/GlassToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAIFeatures } from "@/hooks/useAIFeatures";
import { useCopy, useLanguage } from "@/i18n";
import { aiFeaturesCopy } from "@/i18n/aiFeatures";
import type { UiLanguage } from "@/lib/types";

// Stored values are the codes; names come from Intl in the app's language. "zh" is
// translated to Simplified Chinese, hence zh-Hans for its name.
const TARGET_LANGUAGES = ["en", "es", "fr", "de", "pt", "it", "nl", "pl", "ru", "tr", "ar", "hi", "ja", "ko", "zh"];

function languageOptions(lang: UiLanguage) {
  const names = new Intl.DisplayNames([lang], { type: "language" });
  return TARGET_LANGUAGES.map((code) => {
    const name = names.of(code === "zh" ? "zh-Hans" : code) ?? code;
    return { value: code, label: name.charAt(0).toLocaleUpperCase(lang) + name.slice(1) };
  });
}

export function AIFeaturesPage() {
  const ai = useAIFeatures();
  const t = useCopy(aiFeaturesCopy);
  const lang = useLanguage();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="mushu-topbar flex items-center justify-between px-6 py-4"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-3">
          <SidebarTrigger style={{ color: "var(--muted-foreground)" }} />
          <div>
            <h1
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--foreground)",
                lineHeight: 1.15,
                letterSpacing: "-0.025em",
                margin: 0,
              }}
            >
              {t.title}
            </h1>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12.5px",
                fontWeight: 450,
                color: "var(--muted-foreground)",
                marginTop: "2px",
              }}
            >
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-3">
          <InfoCard
            icon={Sparkles}
            color="var(--primary)"
            title={t.agentTitle}
            description={t.agentBody}
            example={t.agentExample}
          />

          <FeatureCard
            icon={Languages}
            color="var(--chart-2)"
            title={t.translateTitle}
            description={t.translateBody}
            value={ai.autoTranslateEnabled}
            onChange={(v) => ai.setField("autoTranslateEnabled", v)}
            extra={
              ai.autoTranslateEnabled ? (
                <div className="flex items-center gap-3 pt-3">
                  <span
                    className="tracking-widest"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "10px",
                      color: "var(--muted-foreground)",
                      textTransform: "uppercase",
                    }}
                  >
                    {t.targetLanguage}
                  </span>
                  <div style={{ minWidth: "180px" }}>
                    <GlassSelect
                      value={ai.autoTranslateTarget}
                      options={languageOptions(lang)}
                      onChange={(v) => ai.setField("autoTranslateTarget", v)}
                    />
                  </div>
                </div>
              ) : null
            }
          />
        </div>

        <p
          className="mt-5"
          style={{
            fontFamily: "'Geist Variable', sans-serif",
            fontSize: "11.5px",
            fontWeight: 450,
            color: "var(--muted-foreground)",
            lineHeight: 1.5,
          }}
        >
          {t.footnote}
        </p>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: LucideIcon;
  color: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  extra?: ReactNode;
}

interface InfoCardProps {
  icon: LucideIcon;
  color: string;
  title: string;
  description: string;
  example?: string;
}

function InfoCard({ icon: Icon, color, title, description, example }: InfoCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start gap-4">
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius)",
            background: `color-mix(in oklab, ${color} 8%, transparent)`,
            border: `0.5px solid color-mix(in oklab, ${color} 19%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={20} strokeWidth={2} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--foreground)",
              letterSpacing: "-0.005em",
              marginBottom: "3px",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "12.5px",
              fontWeight: 450,
              color: "color-mix(in oklab, var(--foreground) 65%, transparent)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
          {example ? (
            <p
              className="mt-2"
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "11.5px",
                fontWeight: 450,
                color: "var(--muted-foreground)",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              {example}
            </p>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}

function FeatureCard({ icon: Icon, color, title, description, value, onChange, extra }: FeatureCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start gap-4">
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius)",
            background: `color-mix(in oklab, ${color} 8%, transparent)`,
            border: `0.5px solid color-mix(in oklab, ${color} 19%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={20} strokeWidth={2} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  letterSpacing: "-0.005em",
                  marginBottom: "3px",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "12.5px",
                  fontWeight: 450,
                  color: "color-mix(in oklab, var(--foreground) 65%, transparent)",
                  lineHeight: 1.5,
                }}
              >
                {description}
              </p>
            </div>
            <GlassToggle value={value} onChange={onChange} />
          </div>
          {extra}
        </div>
      </div>
    </GlassCard>
  );
}
