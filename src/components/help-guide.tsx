"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Compass,
  LayoutDashboard,
  GitCompare,
  Newspaper,
  Settings,
  Lightbulb,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/format";

export function HelpGuide() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("discovery");

  const sections = [
    { key: "discovery", icon: Compass },
    { key: "detail", icon: LayoutDashboard },
    { key: "compare", icon: GitCompare },
    { key: "feeds", icon: Newspaper },
    { key: "settings", icon: Settings },
    { key: "concepts", icon: Lightbulb },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">{t("help.title")}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scroll-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HelpCircle className="h-5 w-5 text-primary" />
              {t("help.title")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t("help.subtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {sections.map(({ key, icon: Icon }) => {
              const isExpanded = expandedSection === key;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-border/60 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : key)}
                    className={cn(
                      "flex items-center justify-between w-full p-3 text-start transition-colors",
                      isExpanded ? "bg-primary/5" : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm">
                        {t(`help.${key}.title`)}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-2 space-y-3 animate-in-fade">
                      {/* Main description */}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t(`help.${key}.desc`)}
                      </p>

                      {/* Discovery: column descriptions */}
                      {key === "discovery" && (
                        <div className="space-y-2 mt-3">
                          <div className="text-xs font-semibold text-foreground">
                            {t("help.discovery.columns")}
                          </div>
                          {[
                            "colSymbol",
                            "colCategory",
                            "colFund",
                            "colConf",
                            "colEff",
                            "colMkt",
                            "colIAFinal",
                            "colGate",
                            "colDecision",
                          ].map((col) => (
                            <div key={col} className="flex gap-2 text-xs">
                              <span className="font-mono text-primary shrink-0 w-24">
                                {t(`discovery.${col}`)}
                              </span>
                              <span className="text-muted-foreground">
                                {t(`help.discovery.${col}`)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Detail: section descriptions */}
                      {key === "detail" && (
                        <div className="space-y-2 mt-3">
                          {[
                            "overview",
                            "ranks",
                            "components",
                            "valueChain",
                            "supply",
                            "gate",
                            "explanation",
                            "benchmark",
                            "thesis",
                          ].map((section) => (
                            <div key={section} className="flex gap-2 text-xs">
                              <span className="font-mono text-primary shrink-0 w-28">
                                {t(`help.detail.${section}`)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Concepts: key term definitions */}
                      {key === "concepts" && (
                        <div className="space-y-3 mt-3">
                          {[
                            "ia",
                            "gate",
                            "decision",
                            "pq",
                            "tq",
                            "va",
                            "v",
                            "r",
                          ].map((concept) => (
                            <div key={concept} className="rounded-md border border-border/40 bg-muted/20 p-2.5">
                              <div className="text-xs">
                                <span className="text-muted-foreground">{t(`help.concepts.${concept}`)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
