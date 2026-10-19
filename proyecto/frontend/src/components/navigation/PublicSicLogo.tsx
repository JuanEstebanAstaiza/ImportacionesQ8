export function PublicSicLogo() {
  return (  
      <a
        href="https://www.sic.gov.co/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ir al sitio web de la Superintendencia de Industria y Comercio (abre en una nueva pestaña)"
        className="inline-flex rounded-full px-3 py-1 bg-[#c45973]/10 hover:bg-[#c45973]/20 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-current border border-transparent hover:!border-[#95354c]"
      >

      <img
        src="/SIC_logo.png"
        alt="Superintendencia de Industria y Comercio"
        className="h-8 w-auto max-w-[140px] object-contain"
      />
    </a>
  );
}
