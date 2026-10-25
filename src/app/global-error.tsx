"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{ background: "#0b0b0c", color: "#ededea", fontFamily: "system-ui, sans-serif", padding: 48 }}
      >
        <h1>Something went wrong.</h1>
        <p>Please reload the page.</p>
        <button type="button" onClick={reset} style={{ padding: "12px 20px", borderRadius: 999 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
