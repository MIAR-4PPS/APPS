export default function MiarLogoAnimation({
  logo = "/__mockup/miar-logo.png",
  size = 260,
}: {
  logo?: string;
  size?: number;
}) {
  const ring = (pct: number, delay: number) => (
    <div
      style={{
        position: "absolute",
        width: `${pct}%`,
        height: `${pct}%`,
        borderRadius: "50%",
        border: "2px solid rgba(0, 220, 255, 0.5)",
        boxShadow: "0 0 24px rgba(0, 220, 255, 0.35)",
        animation: `miarExpand 3s ease-out ${delay}s infinite`,
      }}
    />
  );

  return (
    <>
      <style>{`
        @keyframes miarPulse {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 22px rgba(0,220,255,0.6)); }
          50%       { transform: scale(1.08); filter: drop-shadow(0 0 36px rgba(0,220,255,0.9)); }
        }
        @keyframes miarExpand {
          0%   { transform: scale(0.72); opacity: 0.8; }
          70%  { opacity: 0.2; }
          100% { transform: scale(1.28); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1117",
        }}
      >
        <div
          style={{
            position: "relative",
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {ring(68, 0)}
          {ring(84, 0.6)}
          {ring(100, 1.2)}

          {/* Wrapper que corta o texto "MIAR APPS" do rodapé da imagem */}
          <div
            style={{
              position: "relative",
              zIndex: 5,
              width: "60%",
              height: "60%",
              overflow: "hidden",
              animation: "miarPulse 2.4s ease-in-out infinite",
            }}
          >
            <img
              src={logo}
              alt="MIAR"
              style={{
                width: "100%",
                height: "125%",       /* mostra só os 80% superiores (ícone sem texto) */
                objectFit: "contain",
                objectPosition: "top center",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
