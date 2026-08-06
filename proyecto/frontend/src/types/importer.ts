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
  /**
   * Datos que la empresa configura en su propio perfil (`perfil_publico`).
   * Antes el perfil público los leía de diccionarios mock indexados por ids de
   * ejemplo, así que lo que la empresa guardaba nunca llegaba a mostrarse.
   */
  description?: string;
  certs?: string[];
  /** Imagen de portada ancha que encabeza la ficha pública. */
  bannerUrl?: string;
  logoUrl?: string;
  advisor: {
    name: string;
    role: string;
    initials: string;
    color: string;
    email: string;
  };
}