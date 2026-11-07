import gsap from "gsap";

/**
 * Transición radial al cambiar de app: tres ondas de color crecen desde el
 * selector hasta cubrir la pantalla, se navega bajo la cobertura y una máscara
 * con un agujero que se expande descubre la pantalla nueva.
 *
 * Vive fuera de React a propósito: al navegar, el selector de la página de
 * origen se desmonta y la animación debe terminar igual.
 */
export function reproducirOndaSuite(opts: { x: number; y: number; color: string; alCubrir: () => void }) {
  const { x, y, color, alCubrir } = opts;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    alCubrir();
    return;
  }

  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  // Diámetro que alcanza la esquina más lejana desde el origen.
  const alcance = Math.hypot(Math.max(x, ancho - x), Math.max(y, alto - y));
  const diametro = 2 * alcance + 4;
  const borde = 48; // transición suave del borde del agujero, en px

  const capa = document.createElement("div");
  capa.setAttribute("aria-hidden", "true");
  Object.assign(capa.style, { position: "fixed", inset: "0", zIndex: "100", pointerEvents: "none", overflow: "hidden" });
  // Las variables CSS se fijan con setProperty: Object.assign no las aplica.
  capa.style.setProperty("--hole-x", `${x}px`);
  capa.style.setProperty("--hole-y", `${y}px`);
  capa.style.setProperty("--hole-radius", "0px");
  const mascara = `radial-gradient(circle at var(--hole-x) var(--hole-y), transparent var(--hole-radius), black calc(var(--hole-radius)))`;
  capa.style.setProperty("mask-image", mascara);
  capa.style.setProperty("-webkit-mask-image", mascara);

  // De la más tenue (va delante) a la sólida, que es la que cubre del todo.
  const ondas = [0.35, 0.6, 1].map((opacidad) => {
    const onda = document.createElement("div");
    Object.assign(onda.style, {
      position: "absolute",
      left: `${x - diametro / 2}px`,
      top: `${y - diametro / 2}px`,
      width: `${diametro}px`,
      height: `${diametro}px`,
      borderRadius: "50%",
      backgroundColor: color,
      opacity: String(opacidad),
      willChange: "transform",
    });
    capa.appendChild(onda);
    return onda;
  });

  document.body.appendChild(capa);
  gsap.set(ondas, { scale: 0 });

  const agujero = { radio: 0 };
  const tl = gsap.timeline({ onComplete: () => capa.remove() });

  tl.to(ondas, { scale: 1, duration: 0.7, stagger: 0.08, ease: "power2.out" }, 0);
  // La pantalla nueva se monta cuando la onda sólida ya cubre todo.
  tl.add(alCubrir, 0.3);
  // El agujero arranca mientras las ondas aún crecen y las alcanza en las esquinas: efecto lupa.
  tl.to(
    agujero,
    {
      radio: alcance + borde,
      duration: 1.1,
      ease: "power2.inOut",
      onUpdate: () => capa.style.setProperty("--hole-radius", `${agujero.radio}px`),
      onComplete: () => capa.style.setProperty("--hole-radius", "0px"),
    },
    0.6,
  );
}

