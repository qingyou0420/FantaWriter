// 幻想作家 / FantaWriter product mark: cream rounded-square tile, calligraphic 幻, white quill.
// PNG is served from packages/studio/public (derived from build/fantawriter-mark.png).
export function FantaWriterLogo({ className }: { readonly className?: string }) {
  return (
    <img
      src="/fantawriter-mark.png"
      alt="幻想作家"
      className={className}
      draggable={false}
    />
  );
}
