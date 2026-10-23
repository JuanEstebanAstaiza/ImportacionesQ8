import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type DynamicAccentTextProps = {
  children: ReactNode;
};

/**
 * Keeps the accent headline readable when the animated accent blob passes
 * behind it. The masked layer changes only the affected portion to primary.
 */
export function DynamicAccentText({ children }: DynamicAccentTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [maskStyle, setMaskStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    const text = textRef.current;
    const section = text?.closest("section");
    const blob = section?.querySelector<HTMLElement>(".zarpi-blob-acid");
    if (!text || !blob) return;

    let frame = 0;
    let previousMask = "";
    const updateMask = () => {
      const textRect = text.getBoundingClientRect();
      const blobRect = blob.getBoundingClientRect();
      const centerX = blobRect.left + blobRect.width / 2 - textRect.left;
      const centerY = blobRect.top + blobRect.height / 2 - textRect.top;
      const mask = `ellipse(${blobRect.width / 2}px ${blobRect.height / 2}px at ${centerX}px ${centerY}px)`;
      if (mask !== previousMask) {
        previousMask = mask;
        setMaskStyle({ clipPath: mask });
      }
      frame = requestAnimationFrame(updateMask);
    };

    frame = requestAnimationFrame(updateMask);
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateMask);
    });
    resizeObserver.observe(text);
    resizeObserver.observe(blob);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <span ref={textRef} className="landing-dynamic-accent-text">
      <span aria-hidden="true" className="landing-dynamic-accent-text__base">
        {children}
      </span>
      <span aria-hidden="true" className="landing-dynamic-accent-text__contrast" style={maskStyle}>
        {children}
      </span>
      <span className="sr-only">{children}</span>
    </span>
  );
}
