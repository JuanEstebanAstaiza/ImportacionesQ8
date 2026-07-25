import type { Course } from "./types";

const TRAILER_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?si=iq8courses";

export const mockCourses: Course[] = [
  {
    id: "course-incoterms-2020",
    titulo: "Incoterms 2020 para importar sin sobrecostos",
    descripcion:
      "Aprende a elegir Incoterms correctos, negociar responsabilidades logisticas y evitar costos ocultos antes de cerrar una compra internacional.",
    portada_url:
      "https://images.unsplash.com/photo-1578574577315-3fbeb0cecdc2?auto=format&fit=crop&w=1200&q=80",
    precio: 149,
    nivel: "Principiante",
    categoria: "Logistica Internacional",
    importadora_nombre: "Grupo Nexus S.A.",
    rating: 4.8,
    estudiantes_count: 126,
    modulos: [
      {
        id: "mod-incoterms-1",
        titulo: "Fundamentos para negociar bien",
        lecciones: [
          {
            id: "les-incoterms-1",
            titulo: "Que cubren y que no cubren los Incoterms",
            duracion: "12 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-inc-1", nombre: "Matriz_Incoterms_2020.xlsx", url: "https://example.com/recursos/matriz-incoterms-2020.xlsx", tipo: "plantilla" },
            ],
          },
          {
            id: "les-incoterms-2",
            titulo: "Errores frecuentes en compras FOB y CIF",
            duracion: "16 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-inc-2", nombre: "Checklist_FOB_vs_CIF.pdf", url: "https://example.com/recursos/checklist-fob-cif.pdf", tipo: "checklist" },
            ],
          },
          {
            id: "les-incoterms-3",
            titulo: "Checklist previo a firmar una orden",
            duracion: "11 min",
            video_url: TRAILER_URL,
            recursos: [],
          },
        ],
      },
      {
        id: "mod-incoterms-2",
        titulo: "Casos practicos con proveedores",
        lecciones: [
          {
            id: "les-incoterms-4",
            titulo: "Simulacion de costos puerta a puerta",
            duracion: "19 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-inc-3", nombre: "Plantilla_Landed_Cost.xlsx", url: "https://example.com/recursos/plantilla-landed-cost.xlsx", tipo: "plantilla" },
            ],
          },
          {
            id: "les-incoterms-5",
            titulo: "Como documentar acuerdos con el proveedor",
            duracion: "14 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-inc-4", nombre: "Formato_Acuerdo_Proveedor.docx", url: "https://example.com/recursos/formato-acuerdo-proveedor.docx", tipo: "archivo" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "course-aduanas-latam",
    titulo: "Ruta aduanera LATAM para importadores en crecimiento",
    descripcion:
      "Domina la documentacion base, los hitos aduaneros y la coordinacion con agentes para reducir retrasos en nacionalizacion.",
    portada_url:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
    precio: 189,
    nivel: "Avanzado",
    categoria: "Aduanas y Cumplimiento",
    importadora_nombre: "SecureVision Corp",
    rating: 4.7,
    estudiantes_count: 84,
    modulos: [
      {
        id: "mod-aduanas-1",
        titulo: "Expediente documental",
        lecciones: [
          {
            id: "les-aduanas-1",
            titulo: "Factura, packing list y BL sin inconsistencias",
            duracion: "15 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-adu-1", nombre: "Ejemplo_Packing_List.pdf", url: "https://example.com/recursos/ejemplo-packing-list.pdf", tipo: "guia" },
            ],
          },
          {
            id: "les-aduanas-2",
            titulo: "Clasificacion arancelaria orientada al negocio",
            duracion: "18 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-adu-2", nombre: "Plantilla_Clasificacion_Arancelaria.xlsx", url: "https://example.com/recursos/plantilla-clasificacion.xlsx", tipo: "plantilla" },
            ],
          },
          {
            id: "les-aduanas-3",
            titulo: "Alertas rojas que frenan inspecciones",
            duracion: "10 min",
            video_url: TRAILER_URL,
            recursos: [],
          },
        ],
      },
      {
        id: "mod-aduanas-2",
        titulo: "Control operativo",
        lecciones: [
          {
            id: "les-aduanas-4",
            titulo: "Linea de tiempo de una importacion real",
            duracion: "17 min",
            video_url: TRAILER_URL,
            recursos: [],
          },
          {
            id: "les-aduanas-5",
            titulo: "Matriz de responsables con proveedor y agente",
            duracion: "13 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-adu-3", nombre: "Matriz_Responsables_Operacion.xlsx", url: "https://example.com/recursos/matriz-responsables.xlsx", tipo: "checklist" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "course-sourcing-asia",
    titulo: "Sourcing inteligente en Asia para categorias tecnicas",
    descripcion:
      "Encuentra proveedores confiables, valida calidad desde origen y arma un proceso de comparacion profesional para compras recurrentes.",
    portada_url:
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
    precio: 219,
    nivel: "Avanzado",
    categoria: "Proveedores y Sourcing",
    importadora_nombre: "TechImport S.A.",
    rating: 4.9,
    estudiantes_count: 63,
    modulos: [
      {
        id: "mod-sourcing-1",
        titulo: "Preseleccion y verificacion",
        lecciones: [
          {
            id: "les-sourcing-1",
            titulo: "Brief de compra que ahorra semanas",
            duracion: "09 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-sou-1", nombre: "Brief_Sourcing_Base.docx", url: "https://example.com/recursos/brief-sourcing-base.docx", tipo: "archivo" },
            ],
          },
          {
            id: "les-sourcing-2",
            titulo: "Auditoria remota de proveedores",
            duracion: "14 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-sou-2", nombre: "Checklist_Auditoria_Proveedor.pdf", url: "https://example.com/recursos/checklist-auditoria-proveedor.pdf", tipo: "checklist" },
            ],
          },
          {
            id: "les-sourcing-3",
            titulo: "Scorecards para comparar fabricas",
            duracion: "12 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-sou-3", nombre: "Scorecard_Proveedores.xlsx", url: "https://example.com/recursos/scorecard-proveedores.xlsx", tipo: "plantilla" },
            ],
          },
        ],
      },
      {
        id: "mod-sourcing-2",
        titulo: "Negociacion y seguimiento",
        lecciones: [
          {
            id: "les-sourcing-4",
            titulo: "MOQ, lead time y condiciones de pago",
            duracion: "21 min",
            video_url: TRAILER_URL,
            recursos: [],
          },
          {
            id: "les-sourcing-5",
            titulo: "Plan de inspeccion previo al embarque",
            duracion: "13 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-sou-4", nombre: "Plan_Inspeccion_Preembarque.pdf", url: "https://example.com/recursos/plan-inspeccion-preembarque.pdf", tipo: "guia" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "course-costeo-importacion",
    titulo: "Costeo real de importacion para decisiones de margen",
    descripcion:
      "Construye una estructura completa de costos, simula escenarios y define precios de venta con criterio financiero.",
    portada_url:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
    precio: 129,
    nivel: "Principiante",
    categoria: "Finanzas de Importacion",
    importadora_nombre: "FoodTrade SRL",
    rating: 4.6,
    estudiantes_count: 172,
    modulos: [
      {
        id: "mod-costeo-1",
        titulo: "Base financiera",
        lecciones: [
          {
            id: "les-costeo-1",
            titulo: "Componentes del landed cost",
            duracion: "11 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-cos-1", nombre: "Landed_Cost_Master.xlsx", url: "https://example.com/recursos/landed-cost-master.xlsx", tipo: "plantilla" },
            ],
          },
          {
            id: "les-costeo-2",
            titulo: "Aranceles, IVA y gastos locales",
            duracion: "15 min",
            video_url: TRAILER_URL,
            recursos: [],
          },
          {
            id: "les-costeo-3",
            titulo: "Margen minimo viable por categoria",
            duracion: "12 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-cos-2", nombre: "Guia_Margen_Minimo.pdf", url: "https://example.com/recursos/guia-margen-minimo.pdf", tipo: "guia" },
            ],
          },
        ],
      },
      {
        id: "mod-costeo-2",
        titulo: "Escenarios y control",
        lecciones: [
          {
            id: "les-costeo-4",
            titulo: "Sensibilidad por tipo de cambio",
            duracion: "14 min",
            video_url: TRAILER_URL,
            recursos: [],
          },
          {
            id: "les-costeo-5",
            titulo: "Tablero para decidir cuando recomprar",
            duracion: "10 min",
            video_url: TRAILER_URL,
            recursos: [
              { id: "res-cos-3", nombre: "Dashboard_Recompra.csv", url: "https://example.com/recursos/dashboard-recompra.csv", tipo: "archivo" },
            ],
          },
        ],
      },
    ],
  },
];