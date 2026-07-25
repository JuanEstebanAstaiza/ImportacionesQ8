import { useEffect, useState } from "react";

import { mockCourses } from "./mockCourses";
import type {
  Course,
  CourseProgress,
  LearningState,
  Lesson,
  LessonResource,
  Module,
  PublishCourseInput,
} from "./types";

const CUSTOM_COURSES_STORAGE_KEY = "iq8_courses_custom";
const PURCHASES_STORAGE_KEY = "iq8_courses_purchases";
const PROGRESS_STORAGE_KEY = "iq8_courses_progress";
const LEARNING_STATE_STORAGE_KEY = "iq8_courses_learning_state";
const DEFAULT_VIDEO_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?si=iq8coursebuilder";

const DEFAULT_LEARNING_STATE: LearningState = {
  lastCourseId: null,
  lastLessonId: null,
  recentCourseIds: [],
  lastLessonIdByCourse: {},
  lastViewedAtByCourse: {},
};

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function normalizeVideoUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return DEFAULT_VIDEO_URL;
  }

  if (trimmed.includes("youtube.com/watch?v=")) {
    const url = new URL(trimmed);
    const videoId = url.searchParams.get("v");
    return videoId ? `https://www.youtube.com/embed/${videoId}` : trimmed;
  }

  if (trimmed.includes("youtu.be/")) {
    const parts = trimmed.split("youtu.be/");
    const videoId = parts[1]?.split(/[?&]/)[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : trimmed;
  }

  if (trimmed.includes("vimeo.com/") && !trimmed.includes("player.vimeo.com")) {
    const parts = trimmed.split("vimeo.com/");
    const videoId = parts[1]?.split(/[?&/]/)[0];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : trimmed;
  }

  return trimmed;
}

function normalizeResource(raw: Partial<LessonResource>): LessonResource {
  return {
    id: raw.id || createId("resource"),
    nombre: raw.nombre?.trim() || "Recurso descargable",
    url: raw.url?.trim() || "https://example.com/recurso",
    tipo: raw.tipo || "archivo",
  };
}

function normalizeLesson(raw: Partial<Lesson>): Lesson {
  return {
    id: raw.id || createId("lesson"),
    titulo: raw.titulo?.trim() || "Leccion sin titulo",
    duracion: raw.duracion?.trim() || "10 min",
    video_url: normalizeVideoUrl(raw.video_url || DEFAULT_VIDEO_URL),
    recursos: Array.isArray(raw.recursos) ? raw.recursos.map((resource) => normalizeResource(resource)) : [],
  };
}

function normalizeModule(raw: Partial<Module>): Module {
  return {
    id: raw.id || createId("module"),
    titulo: raw.titulo?.trim() || "Modulo",
    lecciones: Array.isArray(raw.lecciones) ? raw.lecciones.map((lesson) => normalizeLesson(lesson)) : [],
  };
}

function normalizeCourse(raw: Partial<Course>): Course {
  return {
    id: raw.id || createId("course"),
    titulo: raw.titulo?.trim() || "Curso",
    descripcion: raw.descripcion?.trim() || "",
    portada_url: raw.portada_url?.trim() || "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80",
    precio: typeof raw.precio === "number" ? raw.precio : 0,
    nivel: raw.nivel || "Principiante",
    categoria: raw.categoria?.trim() || "General",
    importadora_nombre: raw.importadora_nombre?.trim() || "Importadora",
    rating: typeof raw.rating === "number" ? raw.rating : 4.5,
    estudiantes_count: typeof raw.estudiantes_count === "number" ? raw.estudiantes_count : 0,
    modulos: Array.isArray(raw.modulos) ? raw.modulos.map((module) => normalizeModule(module)) : [],
  };
}

function buildCourseFromInput(input: PublishCourseInput): Course {
  return normalizeCourse({
    id: createId("course"),
    titulo: input.titulo,
    descripcion: input.descripcion,
    portada_url: input.portada_url,
    precio: input.precio,
    nivel: input.nivel,
    categoria: input.categoria,
    importadora_nombre: input.importadora_nombre,
    rating: 4.6,
    estudiantes_count: 0,
    modulos: input.modulos.map((module) => ({
      id: createId("module"),
      titulo: module.titulo,
      lecciones: module.lecciones.map((lesson) => ({
        id: createId("lesson"),
        titulo: lesson.titulo,
        duracion: lesson.duracion,
        video_url: lesson.video_url,
        recursos: lesson.recursos.map((resource) => ({
          id: createId("resource"),
          nombre: resource.nombre,
          url: resource.url,
          tipo: resource.tipo,
        })),
      })),
    })),
  });
}

function normalizeLearningState(raw: Partial<LearningState>): LearningState {
  return {
    lastCourseId: raw.lastCourseId || null,
    lastLessonId: raw.lastLessonId || null,
    recentCourseIds: Array.isArray(raw.recentCourseIds) ? raw.recentCourseIds : [],
    lastLessonIdByCourse: raw.lastLessonIdByCourse || {},
    lastViewedAtByCourse: raw.lastViewedAtByCourse || {},
  };
}

export function useCourses() {
  const [customCourses, setCustomCourses] = useState<Course[]>(() => readLocalStorage<Partial<Course>[]>(CUSTOM_COURSES_STORAGE_KEY, []).map((course) => normalizeCourse(course)));
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<string[]>(() => readLocalStorage(PURCHASES_STORAGE_KEY, []));
  const [completedLessonsByCourse, setCompletedLessonsByCourse] = useState<CourseProgress>(() => readLocalStorage(PROGRESS_STORAGE_KEY, {}));
  const [learningState, setLearningState] = useState<LearningState>(() => normalizeLearningState(readLocalStorage(LEARNING_STATE_STORAGE_KEY, DEFAULT_LEARNING_STATE)));

  useEffect(() => {
    writeLocalStorage(CUSTOM_COURSES_STORAGE_KEY, customCourses);
  }, [customCourses]);

  useEffect(() => {
    writeLocalStorage(PURCHASES_STORAGE_KEY, purchasedCourseIds);
  }, [purchasedCourseIds]);

  useEffect(() => {
    writeLocalStorage(PROGRESS_STORAGE_KEY, completedLessonsByCourse);
  }, [completedLessonsByCourse]);

  useEffect(() => {
    writeLocalStorage(LEARNING_STATE_STORAGE_KEY, learningState);
  }, [learningState]);

  const courses = [...customCourses, ...mockCourses.map((course) => normalizeCourse(course))].map((course) => ({
    ...course,
    estudiantes_count: course.estudiantes_count + (purchasedCourseIds.includes(course.id) ? 1 : 0),
  }));

  function purchaseCourse(courseId: string): void {
    setPurchasedCourseIds((current) => {
      if (current.includes(courseId)) {
        return current;
      }
      return [...current, courseId];
    });
  }

  function publishCourse(input: PublishCourseInput): Course {
    const course = buildCourseFromInput(input);
    setCustomCourses((current) => [course, ...current]);
    return course;
  }

  function toggleLessonCompleted(courseId: string, lessonId: string, completed: boolean): void {
    setCompletedLessonsByCourse((current) => {
      const currentLessons = current[courseId] || [];
      const nextLessons = completed
        ? Array.from(new Set([...currentLessons, lessonId]))
        : currentLessons.filter((id) => id !== lessonId);

      return {
        ...current,
        [courseId]: nextLessons,
      };
    });
  }

  function markLessonViewed(courseId: string, lessonId: string): void {
    setLearningState((current) => ({
      lastCourseId: courseId,
      lastLessonId: lessonId,
      recentCourseIds: [courseId, ...current.recentCourseIds.filter((id) => id !== courseId)].slice(0, 10),
      lastLessonIdByCourse: {
        ...current.lastLessonIdByCourse,
        [courseId]: lessonId,
      },
      lastViewedAtByCourse: {
        ...current.lastViewedAtByCourse,
        [courseId]: new Date().toISOString(),
      },
    }));
  }

  return {
    courses,
    purchasedCourseIds,
    completedLessonsByCourse,
    learningState,
    purchaseCourse,
    publishCourse,
    toggleLessonCompleted,
    markLessonViewed,
  };
}