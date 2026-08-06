export type CourseLevel = "Principiante" | "Avanzado";
export type ResourceType = "archivo" | "plantilla" | "checklist" | "guia";

export interface LessonResource {
  id: string;
  nombre: string;
  url: string;
  tipo: ResourceType;
}

export interface Lesson {
  id: string;
  titulo: string;
  duracion: string;
  video_url: string;
  es_preview?: boolean;
  orden?: number;
  recursos: LessonResource[];
}

export interface Module {
  id: string;
  titulo: string;
  orden?: number;
  lecciones: Lesson[];
}

export interface Course {
  id: string;
  slug?: string;
  titulo: string;
  descripcion: string;
  portada_url?: string | null;
  precio: number;
  nivel: CourseLevel;
  categoria: string;
  importador_id?: string;
  importadora_nombre: string;
  rating: number;
  estudiantes_count: number;
  estado?: string;
  fecha_creacion?: string | null;
  comprado?: boolean;
  progreso_pct?: number;
  modulos: Module[];
}

export interface PublishLessonResourceInput {
  id?: string;
  nombre: string;
  url: string;
  tipo: ResourceType;
}

/**
 * Al editar un curso hay que devolver el `id` que entregó el backend: es lo que
 * le permite reconocer la lección y conservar el progreso que los alumnos ya
 * tenían sobre ella. Sin `id` la lección se trata como nueva.
 */
export interface PublishLessonInput {
  id?: string;
  titulo: string;
  duracion: string;
  video_url: string;
  es_preview?: boolean;
  recursos: PublishLessonResourceInput[];
}

export interface PublishModuleInput {
  id?: string;
  titulo: string;
  lecciones: PublishLessonInput[];
}

export interface PublishCourseInput {
  titulo: string;
  descripcion: string;
  portada_url?: string;
  precio: number;
  nivel: CourseLevel;
  categoria: string;
  modulos: PublishModuleInput[];
}

export type CourseProgress = Record<string, string[]>;

export interface LearningState {
  lastCourseId: string | null;
  lastLessonId: string | null;
  recentCourseIds: string[];
  lastLessonIdByCourse: Record<string, string>;
  lastViewedAtByCourse: Record<string, string>;
}