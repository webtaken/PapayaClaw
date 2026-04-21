"use client";

import { useEffect } from "react";

export function ScrollToHash() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;

    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;

    let cancelled = false;

    const scrollToTarget = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "auto", block: "start" });
    };

    scrollToTarget();
    requestAnimationFrame(scrollToTarget);

    const images = Array.from(document.images);
    const pending = images.filter((img) => !img.complete);

    if (pending.length === 0) {
      const t = window.setTimeout(scrollToTarget, 100);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    let remaining = pending.length;
    const onDone = () => {
      remaining -= 1;
      if (remaining <= 0) scrollToTarget();
    };

    pending.forEach((img) => {
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    });

    const fallback = window.setTimeout(scrollToTarget, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      pending.forEach((img) => {
        img.removeEventListener("load", onDone);
        img.removeEventListener("error", onDone);
      });
    };
  }, []);

  return null;
}
