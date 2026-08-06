import { apiRequest } from "@/services/api-client";
import type { Course, Module, Lesson, LessonResource, PublishCourseInput } from "@/features/courses/types";

interface BackendLessonResource {
  id: string;
  nombre: string;
  url: string;
  tipo: "archivo" | "plantilla" | "checklist" | "guia";
}

interface BackendLesson {
  id: string;
  titulo: string;
  duracion: string;
  video_url: string;
  es_preview: boolean;
  orden: number;
  recursos: BackendLessonResource[];
}

interface BackendModule {
  id: string;
  titulo: string;
  orden: number;
  lecciones: BackendLesson[];
}

interface BackendCourseListItem {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  portada_url: string | null;
  precio: number;
  nivel: "Principiante" | "Avanzado";
  categoria: string;
  importador_id: string;
  importadora_nombre: string | null;
  rating: number;
  estudiantes_count: number;
  estado: string;
  fecha_creacion: string | null;
}

interface BackendCourseDetail extends BackendCourseListItem {
  modulos: BackendModule[];
  comprado: boolean;
  lecciones_completadas: string[];
  progreso_pct: number;
}

interface CompraCursoResponse {
  id: string;
  curso_id: string;
  usuario_id: string;
  precio_pagado: number;
  fecha_compra: string;
  curso: BackendCourseListItem | null;
}

interface ProgresoLeccionResponse {
  curso_id: string;
  leccion_id: string;
  completada: boolean;
  lecciones_completadas: string[];
  total_lecciones: number;
  progreso_pct: number;
  fecha_completado: string | null;
}

export interface CertificadoCursoResponse {
  curso_id: string;
  curso_titulo: string;
  archivo_id: string;
  url_descarga: string;
  fecha_emision: string | null;
}

type ApiEnvelope<T> = {
  data?: T | ApiEnvelope<T>;
};

export interface CourseFilters {
  categoria?: string;
  nivel?: "Principiante" | "Avanzado";
  q?: string;
  recomendados?: boolean;
  importador_id?: string;
  limit?: number;
  offset?: number;
}

function mapResource(resource: BackendLessonResource): LessonResource {
  return {
    id: resource.id,
    nombre: resource.nombre,
    url: resource.url,
    tipo: resource.tipo,
  };
}

function mapLesson(lesson: BackendLesson): Lesson {
  return {
    id: lesson.id,
    titulo: lesson.titulo,
    duracion: lesson.duracion,
    video_url: lesson.video_url,
    es_preview: lesson.es_preview,
    orden: lesson.orden,
    recursos: Array.isArray(lesson.recursos) ? lesson.recursos.map(mapResource) : [],
  };
}

function mapModule(module: BackendModule): Module {
  return {
    id: module.id,
    titulo: module.titulo,
    orden: module.orden,
    lecciones: Array.isArray(module.lecciones) ? module.lecciones.map(mapLesson) : [],
  };
}

function unwrapApiData<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = payload.data;
    if (typeof nested !== "undefined") {
      return unwrapApiData(nested as T | ApiEnvelope<T>);
    }
  }

  return payload as T;
}

export function mapBackendCourseToCourse(course: BackendCourseListItem | BackendCourseDetail): Course {
  const withDetail = "modulos" in course;
  return {
    id: course.id,
    slug: course.slug,
    titulo: course.titulo,
    descripcion: course.descripcion,
    portada_url: course.portada_url,
    precio: Number(course.precio || 0),
    nivel: course.nivel,
    categoria: course.categoria,
    importador_id: course.importador_id,
    importadora_nombre: course.importadora_nombre || "Importadora",
    rating: Number(course.rating || 0),
    estudiantes_count: Number(course.estudiantes_count || 0),
    estado: course.estado,
    fecha_creacion: course.fecha_creacion,
    comprado: withDetail ? course.comprado : false,
    progreso_pct: withDetail ? Number(course.progreso_pct || 0) : 0,
    modulos: withDetail ? course.modulos.map(mapModule) : [],
  };
}

function buildQuery(filters: CourseFilters = {}): string {
  const params = new URLSearchParams();

  if (filters.categoria) params.set("categoria", filters.categoria);
  if (filters.nivel) params.set("nivel", filters.nivel);
  if (filters.q) params.set("q", filters.q);
  if (typeof filters.recomendados === "boolean") params.set("recomendados", String(filters.recomendados));
  if (filters.importador_id) params.set("importador_id", filters.importador_id);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));

  const query = params.toString();
  return query ? `/cursos?${query}` : "/cursos";
}

function toPublishPayload(input: PublishCourseInput): Record<string, unknown> {
  return {
    titulo: input.titulo,
    descripcion: input.descripcion,
    portada_url: input.portada_url || null,
    precio: input.precio,
    nivel: input.nivel,
    categoria: input.categoria,
    // Los ids solo se envían cuando existen (edición). En una publicación nueva
    // se omiten y el backend genera los suyos.
    modulos: input.modulos.map((module) => ({
      ...(module.id ? { id: module.id } : {}),
      titulo: module.titulo,
      lecciones: module.lecciones.map((lesson, index) => ({
        ...(lesson.id ? { id: lesson.id } : {}),
        titulo: lesson.titulo,
        duracion: lesson.duracion,
        video_url: lesson.video_url,
        es_preview: Boolean(lesson.es_preview) || index === 0,
        recursos: lesson.recursos.map((resource) => ({
          nombre: resource.nombre,
          url: resource.url,
          tipo: resource.tipo,
        })),
      })),
    })),
  };
}

export const coursesService = {
  async listCourses(filters: CourseFilters = {}): Promise<Course[]> {
    const response = await apiRequest<BackendCourseListItem[] | ApiEnvelope<BackendCourseListItem[]>>(buildQuery(filters), { method: "GET" });
    const rows = unwrapApiData<BackendCourseListItem[]>(response);
    return rows.map(mapBackendCourseToCourse);
  },

  async getCourseDetail(idOrSlug: string): Promise<{ course: Course; completedLessonIds: string[] }> {
    const normalizedIdOrSlug = idOrSlug?.trim();
    if (!normalizedIdOrSlug) {
      throw new Error("No se encontró el identificador del curso.");
    }

    const response = await apiRequest<BackendCourseDetail | ApiEnvelope<BackendCourseDetail>>(`/cursos/${normalizedIdOrSlug}`, { method: "GET" });
    const row = unwrapApiData<BackendCourseDetail>(response);
    return {
      course: mapBackendCourseToCourse(row),
      completedLessonIds: Array.isArray(row.lecciones_completadas) ? row.lecciones_completadas : [],
    };
  },

  async publishCourse(payload: PublishCourseInput): Promise<Course> {
    const response = await apiRequest<BackendCourseDetail | ApiEnvelope<BackendCourseDetail>>("/cursos", {
      method: "POST",
      body: toPublishPayload(payload),
    });
    const row = unwrapApiData<BackendCourseDetail>(response);
    return mapBackendCourseToCourse(row);
  },

  async updateCourse(courseId: string, payload: PublishCourseInput): Promise<Course> {
    const response = await apiRequest<BackendCourseDetail | ApiEnvelope<BackendCourseDetail>>(`/cursos/${courseId}`, {
      method: "PUT",
      body: toPublishPayload(payload),
    });
    const row = unwrapApiData<BackendCourseDetail>(response);
    return mapBackendCourseToCourse(row);
  },

  deleteCourse(courseId: string): Promise<{ success?: boolean }> {
    return apiRequest<{ success?: boolean }>(`/cursos/${courseId}`, {
      method: "DELETE",
    });
  },

  purchaseCourse(courseId: string): Promise<CompraCursoResponse> {
    return apiRequest<CompraCursoResponse>(`/cursos/${courseId}/comprar`, {
      method: "POST",
    });
  },

  async listMyCourses(): Promise<{ courses: Course[]; completedByCourseId: Record<string, string[]> }> {
    const response = await apiRequest<BackendCourseDetail[] | ApiEnvelope<BackendCourseDetail[]>>("/mis-cursos", { method: "GET" });
    const rows = unwrapApiData<BackendCourseDetail[]>(response);
    const courses = rows.map(mapBackendCourseToCourse);
    const completedByCourseId = Object.fromEntries(
      rows.map((row) => [row.id, Array.isArray(row.lecciones_completadas) ? row.lecciones_completadas : []]),
    );
    return { courses, completedByCourseId };
  },

  /**
   * Certificado de finalización. El backend responde 409 mientras el alumno no
   * haya completado el 100% del curso, y es idempotente: emite el PDF una vez y
   * después devuelve siempre el mismo archivo.
   */
  getCertificate(courseId: string): Promise<CertificadoCursoResponse> {
    return apiRequest<CertificadoCursoResponse>(`/cursos/${courseId}/certificado`, { method: "GET" });
  },

  markLessonProgress(courseId: string, lessonId: string, completada: boolean): Promise<ProgresoLeccionResponse> {
    return apiRequest<ProgresoLeccionResponse>(`/cursos/${courseId}/lecciones/${lessonId}/progreso`, {
      method: "POST",
      body: { completada },
    });
  },
};
