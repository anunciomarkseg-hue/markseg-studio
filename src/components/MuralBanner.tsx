/* eslint-disable @next/next/no-img-element */
/**
 * Faixa ilustrativa (banner) do Mural/Conversas — imagem em
 *   public/brand/mural-banner-logo.png
 * É só um detalhe/enfeite: baixa, com transparência e desbotada,
 * integrando ao fundo pra o MURAL continuar sendo o protagonista.
 */
export function MuralBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden bg-canvas ${className}`}>
      <img
        src="/brand/mural-banner-logo.png"
        alt=""
        aria-hidden
        className="block h-full w-full object-cover object-center opacity-60"
      />
      {/* véu que suaviza a cor + funde na cor de fundo da página (é ilustração, não o principal) */}
      <div className="pointer-events-none absolute inset-0 bg-canvas/30" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}
