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
  recursos: LessonResource[];
}

export interface Module {
  id: string;
  titulo: string;
  lecciones: Lesson[];
}

export interface Course {
  id: string;
  titulo: string;
  descripcion: string;
  portada_url: string;
  precio: number;
  nivel: CourseLevel;
  categoria: string;
  importadora_nombre: string;
  rating: number;
  estudiantes_count: number;
  modulos: Module[];
}

export interface PublishLessonResourceInput {
  nombre: string;
  url: string;
  tipo: ResourceType;
}

export interface PublishLessonInput {
  titulo: string;
  duracion: string;
  video_url: string;
  recursos: PublishLessonResourceInput[];
}

export interface PublishModuleInput {
  titulo: string;
  lecciones: PublishLessonInput[];
}

export interface PublishCourseInput {
  titulo: string;
  descripcion: string;
  portada_url: string;
  precio: number;
  nivel: CourseLevel;
  categoria: string;
  importadora_nombre: string;
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