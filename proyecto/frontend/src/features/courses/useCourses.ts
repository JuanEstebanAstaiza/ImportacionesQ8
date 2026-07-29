import { useCallback, useEffect, useMemo, useState } from "react";

import type { Course, CourseProgress, LearningState, PublishCourseInput } from "./types";
import { coursesService } from "@/services/courses.service";

const DEFAULT_LEARNING_STATE: LearningState = {
  lastCourseId: null,
  lastLessonId: null,
  recentCourseIds: [],
  lastLessonIdByCourse: {},
  lastViewedAtByCourse: {},
};

function normalizeLearningState(raw: Partial<LearningState>): LearningState {
  return {
    lastCourseId: raw.lastCourseId || null,
    lastLessonId: raw.lastLessonId || null,
    recentCourseIds: Array.isArray(raw.recentCourseIds) ? raw.recentCourseIds : [],
    lastLessonIdByCourse: raw.lastLessonIdByCourse || {},
    lastViewedAtByCourse: raw.lastViewedAtByCourse || {},
  };
}

function mergeCourseRows(catalogRows: Course[], myCourses: Course[]): Course[] {
  const myById = new Map(myCourses.map((row) => [row.id, row]));
  const merged = catalogRows.map((row) => {
    const own = myById.get(row.id);
    return own ? { ...row, ...own, modulos: own.modulos } : row;
  });

  myCourses.forEach((row) => {
    if (!merged.some((item) => item.id === row.id)) {
      merged.unshift(row);
    }
  });

  return merged;
}

export function useCourses() {
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<string[]>([]);
  const [completedLessonsByCourse, setCompletedLessonsByCourse] = useState<CourseProgress>({});
  const [learningState, setLearningState] = useState<LearningState>(() => normalizeLearningState(DEFAULT_LEARNING_STATE));
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courses = useMemo(
    () => catalogCourses.map((course) => ({
      ...course,
      comprado: purchasedCourseIds.includes(course.id),
    })),
    [catalogCourses, purchasedCourseIds],
  );

  const refreshCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const catalog = await coursesService.listCourses();
      let myCourses: Course[] = [];
      let completedByCourseId: Record<string, string[]> = {};

      try {
        const my = await coursesService.listMyCourses();
        myCourses = my.courses;
        completedByCourseId = my.completedByCourseId;
      } catch {
        myCourses = [];
        completedByCourseId = {};
      }

      setCatalogCourses(mergeCourseRows(catalog, myCourses));
      setPurchasedCourseIds(myCourses.map((row) => row.id));
      setCompletedLessonsByCourse(completedByCourseId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el catálogo de cursos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCourses();
  }, [refreshCourses]);

  async function fetchCourseDetail(courseIdOrSlug: string): Promise<Course> {
    const normalizedIdOrSlug = courseIdOrSlug?.trim();
    if (!normalizedIdOrSlug) {
      const parameterError = new Error("No se encontró el identificador del curso.");
      setError(parameterError.message);
      throw parameterError;
    }

    setIsFetchingDetail(true);
    setError(null);
    try {
      const { course, completedLessonIds } = await coursesService.getCourseDetail(normalizedIdOrSlug);
      setCatalogCourses((current) => {
        const exists = current.some((row) => row.id === course.id);
        if (!exists) {
          return [course, ...current];
        }
        return current.map((row) => row.id === course.id ? { ...row, ...course } : row);
      });

      if (course.comprado) {
        setPurchasedCourseIds((current) => current.includes(course.id) ? current : [...current, course.id]);
        setCompletedLessonsByCourse((current) => ({
          ...current,
          [course.id]: completedLessonIds,
        }));
      }

      return course;
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "No se pudo cargar la información del curso.";
      setError(message);
      throw requestError;
    } finally {
      setIsFetchingDetail(false);
    }
  }

  async function purchaseCourse(courseId: string): Promise<void> {
    await coursesService.purchaseCourse(courseId);
    await fetchCourseDetail(courseId);
  }

  async function publishCourse(input: PublishCourseInput): Promise<Course> {
    const created = await coursesService.publishCourse(input);
    setCatalogCourses((current) => [created, ...current.filter((row) => row.id !== created.id)]);
    return created;
  }

  async function toggleLessonCompleted(courseId: string, lessonId: string, completed: boolean): Promise<void> {
    setIsSavingProgress(true);
    try {
      const result = await coursesService.markLessonProgress(courseId, lessonId, completed);
      setCompletedLessonsByCourse((current) => ({
        ...current,
        [result.curso_id]: result.lecciones_completadas,
      }));
      setCatalogCourses((current) => current.map((row) => (
        row.id === result.curso_id
          ? { ...row, progreso_pct: result.progreso_pct }
          : row
      )));
    } finally {
      setIsSavingProgress(false);
    }
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
    isLoading,
    isFetchingDetail,
    isSavingProgress,
    error,
    refreshCourses,
    fetchCourseDetail,
    purchaseCourse,
    publishCourse,
    toggleLessonCompleted,
    markLessonViewed,
  };
}