"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const next = locale === "fa" ? "en" : "fa";

  const switchLocale = () => {
    const segments = pathname.split("/");
    segments[1] = next;
    const newPath = segments.join("/") || "/";
    startTransition(() => {
      router.replace(newPath, { scroll: false });
    });
  };

  return (
    <button
      onClick={switchLocale}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60"
      aria-label="Toggle language"
      title={next.toUpperCase()}
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span className="font-semibold">{next.toUpperCase()}</span>
    </button>
  );
}
