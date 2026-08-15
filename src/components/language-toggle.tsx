"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const next = locale === "fa" ? "en" : "fa";

  const switchLocale = () => {
    // pathname already includes the current locale segment under [locale]
    const segments = pathname.split("/");
    segments[1] = next;
    const newPath = segments.join("/") || "/";
    startTransition(() => {
      router.replace(newPath, { scroll: false });
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      disabled={isPending}
      className="gap-2 font-medium"
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      {next.toUpperCase()}
    </Button>
  );
}
