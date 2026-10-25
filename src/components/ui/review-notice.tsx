/** Marks policy text that a real business would need to review before launch. */
export function ReviewNotice() {
  return (
    <p role="note" className="!mb-10 rounded-card border border-warn/60 p-4 text-sm !text-warn">
      Demo policy for a fictional store. A real business must have this text reviewed before launch.
    </p>
  );
}
