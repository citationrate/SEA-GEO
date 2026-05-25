"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/meta-track";

export default function MetaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    void trackEvent("PageView");
  }, [pathname, searchParams]);

  return null;
}
