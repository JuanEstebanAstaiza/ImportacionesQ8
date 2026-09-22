export interface Importer {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  responseTime: string;
  initials: string;
  color: string;
  memberSince: string;
  projects: number;
  verified: boolean;
  country: string;
  categories: string[];
  tierMinimoRequerido?: "Bronze" | "Silver" | "Gold" | "Élite";
  /**
   * Datos que la empresa configura en su propio perfil (`perfil_publico`).
   * Antes el perfil público los leía de diccionarios mock indexados por ids de
   * ejemplo, así que lo que la empresa guardaba nunca llegaba a mostrarse.
   */
  description?: string;
  certs?: string[];
  /**
   * Sellos que la plataforma respalda (distintos de `certs`, que son las
   * certificaciones externas que la propia empresa declara).
   */
  platformCerts?: Array<{
    id: string;
    nombre: string;
    descripcion: string;
    logoUrl: string;
    peso: number;
  }>;
  /** Suma de pesos de los sellos: el backend ya ordena el catálogo por esto. */
  adScore?: number;
  /**
   * Prefijo de la empresa en el shipping mark (ej. "ctl"). Se enseña al
   * solicitante mientras redacta la cotización para que vea cómo quedará
   * rotulada su carga antes de enviarla.
   */
  shippingMarkPrefix?: string;
  /** Imagen de portada ancha que encabeza la ficha pública. */
  bannerUrl?: string;
  logoUrl?: string;
  /**
   * Datos de contacto y ficha corporativa que la empresa escribe en su propio
   * perfil. Se guardaban en `perfil_publico` pero no se leían en ninguna
   * pantalla, así que rellenarlos no cambiaba nada de lo que veía el cliente.
   */
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  foundedYear?: string;
  /** Sectores a los que la empresa dice atender ("Retail", "Industrial"...). */
  industries?: string[];
  advisor: {
    name: string;
    role: string;
    initials: string;
    color: string;
    email: string;
    phone?: string;
  };
}