"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import styles from "./qr-code-button.module.css";

const SITE_URL = "https://robs-fractals.onrender.com/";

export default function QrCodeButton() {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || dataUrl) return;
    QRCode.toDataURL(SITE_URL, { width: 320, margin: 1 }).then(setDataUrl);
  }, [open, dataUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Show QR code for this site"
      >
        <QrIcon />
        <span>QR code</span>
      </button>

      {open && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="QR code for robs-fractals.onrender.com"
            ref={dialogRef}
          >
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="QR code linking to robs-fractals.onrender.com" width={320} height={320} />
            ) : (
              <div className={styles.placeholder} />
            )}
            <p className={styles.url}>{SITE_URL}</p>
          </div>
        </div>
      )}
    </>
  );
}

function QrIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM14 20h3M20 14v3M20 20h.01" />
    </svg>
  );
}
