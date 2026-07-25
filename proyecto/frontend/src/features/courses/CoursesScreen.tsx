import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  CirclePlay,
  Coins,
  FileDown,
  Flame,
  FolderKanban,
  GraduationCap,
  LibraryBig,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { clsx } from "clsx";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Textarea } from "@/app/components/ui/textarea";

import { useCourses } from "./useCourses";
import type {
  Course,
  CourseLevel,
  Lesson,
  PublishCourseInput,
  PublishLessonResourceInput,
  ResourceType,
} from "./types";

type CoursesScreenProps = {
  role: "solicitante" | "importadora";
  companyName: string;
  onGoDashboard: () => void;
};

type DraftResource = {
  id: string;
  nombre: string;
  url: string;
  tipo: ResourceType;
};

type DraftLesson = {
  id: string;
  titulo: string;
  duracion: string;
  video_url: string;
  recursos: DraftResource[];
};

type DraftModule = {
  id: string;
  titulo: string;
  lecciones: DraftLesson[];
};

type PublishFormState = {
  titulo: string;
  descripcion: string;
  portada_url: string;
  precio: string;
  nivel: CourseLevel;
  categoria: string;
  modulos: DraftModule[];
};

const IMAGE_FALLBACK = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80";
const CATEGORY_SHORTCUTS = [
  "Logistica Internacional",
  "Proveedores y Sourcing",
  "Aduanas y Cumplimiento",
  "Incoterms",
  "Regulaciones",
];

function createTempId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function createDraftResource(): DraftResource {
  return {
    id: createTempId("resource"),
    nombre: "",
    url: "",
    tipo: "archivo",
  };
}

function createDraftLesson(): DraftLesson {
  return {
    id: createTempId("lesson"),
    titulo: "",
    duracion: "10 min",
    video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ?si=iq8coursesdraft",
    recursos: [createDraftResource()],
  };
}

function createDraftModule(): DraftModule {
  return {
    id: createTempId("module"),
    titulo: "Modulo 1",
    lecciones: [createDraftLesson()],
  };
}

const INITIAL_PUBLISH_FORM: PublishFormState = {
  titulo: "",
  descripcion: "",
  portada_url: "",
  precio: "",
  nivel: "Principiante",
  categoria: "",
  modulos: [createDraftModule()],
};

function flattenLessons(course: Course | null): Lesson[] {
  if (!course) {
    return [];
  }

  return course.modulos.flatMap((modulo) => modulo.lecciones);
}

function findLessonIndex(course: Course | null, lessonId: string | null): number {
  if (!course || !lessonId) {
    return 0;
  }

  return Math.max(0, flattenLessons(course).findIndex((lesson) => lesson.id === lessonId));
}

function getProgressPercentage(course: Course, completedLessonIds: string[]): number {
  const lessons = flattenLessons(course);
  if (lessons.length === 0) {
    return 0;
  }

  return Math.round((completedLessonIds.length / lessons.length) * 100);
}

function getNextLesson(course: Course | null, currentLessonId: string | null, completedLessonIds: string[]): Lesson | null {
  if (!course) {
    return null;
  }

  const lessons = flattenLessons(course);
  if (lessons.length === 0) {
    return null;
  }

  const currentIndex = findLessonIndex(course, currentLessonId);
  const nextIncomplete = lessons.find((lesson, index) => index >= currentIndex && !completedLessonIds.includes(lesson.id));
  return nextIncomplete || lessons[Math.min(currentIndex + 1, lessons.length - 1)] || lessons[0];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function isEmbeddableVideo(url: string): boolean {
  return !/\.mp4($|\?)/i.test(url);
}

function toPublishInput(form: PublishFormState, companyName: string): { value: PublishCourseInput | null; error: string } {
  const precio = Number(form.precio);

  if (!form.titulo.trim() || !form.descripcion.trim() || !form.portada_url.trim() || !form.categoria.trim()) {
    return { value: null, error: "Completa titulo, descripcion, categoria e imagen del curso." };
  }

  if (Number.isNaN(precio) || precio <= 0) {
    return { value: null, error: "Ingresa un precio valido mayor a cero." };
  }

  if (form.modulos.length === 0) {
    return { value: null, error: "Agrega al menos un modulo." };
  }

  const modules = [] as PublishCourseInput["modulos"];

  for (const module of form.modulos) {
    if (!module.titulo.trim()) {
      return { value: null, error: "Cada modulo necesita un titulo." };
    }

    if (module.lecciones.length === 0) {
      return { value: null, error: "Cada modulo necesita al menos una leccion." };
    }

    const lessons = [] as PublishCourseInput["modulos"][number]["lecciones"];

    for (const lesson of module.lecciones) {
      if (!lesson.titulo.trim() || !lesson.duracion.trim() || !lesson.video_url.trim()) {
        return { value: null, error: "Cada leccion debe incluir titulo, duracion y enlace multimedia." };
      }

      const resources = [] as PublishLessonResourceInput[];
      for (const resource of lesson.recursos) {
        const hasName = Boolean(resource.nombre.trim());
        const hasUrl = Boolean(resource.url.trim());

        if (hasName !== hasUrl) {
          return { value: null, error: "Cada recurso debe tener nombre y URL, o dejarse vacio para ignorarlo." };
        }

        if (hasName && hasUrl) {
          resources.push({
            nombre: resource.nombre.trim(),
            url: resource.url.trim(),
            tipo: resource.tipo,
          });
        }
      }

      lessons.push({
        titulo: lesson.titulo.trim(),
        duracion: lesson.duracion.trim(),
        video_url: lesson.video_url.trim(),
        recursos: resources,
      });
    }

    modules.push({
      titulo: module.titulo.trim(),
      lecciones: lessons,
    });
  }

  return {
    value: {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      portada_url: form.portada_url.trim(),
      precio,
      nivel: form.nivel,
      categoria: form.categoria.trim(),
      importadora_nombre: companyName,
      modulos: modules,
    },
    error: "",
  };
}

function sortByRecent<T extends Course>(rows: T[], recentCourseIds: string[]): T[] {
  return [...rows].sort((left, right) => {
    const leftIndex = recentCourseIds.indexOf(left.id);
    const rightIndex = recentCourseIds.indexOf(right.id);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight;
  });
}

export function CoursesScreen({ role, companyName, onGoDashboard }: CoursesScreenProps) {
  const {
    courses,
    purchasedCourseIds,
    completedLessonsByCourse,
    learningState,
    purchaseCourse,
    publishCourse,
    toggleLessonCompleted,
    markLessonViewed,
  } = useCourses();
  const [mainTab, setMainTab] = useState<"all" | "mine">("all");
  const [exploreTab, setExploreTab] = useState<"recommended" | "popular" | "categories">("recommended");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [ratingFilter, setRatingFilter] = useState("Todas");
  const [priceFilter, setPriceFilter] = useState("Todas");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activePlayerCourseId, setActivePlayerCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState<PublishFormState>(INITIAL_PUBLISH_FORM);
  const [publishError, setPublishError] = useState("");

  const categories = useMemo(() => ["Todas", ...Array.from(new Set([...CATEGORY_SHORTCUTS, ...courses.map((course) => course.categoria)]))], [courses]);

  const filteredCourses = useMemo(() => (
    courses.filter((course) => {
      const haystack = [course.titulo, course.descripcion, course.importadora_nombre, course.categoria].join(" ").toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "Todas" || course.categoria === categoryFilter;
      const matchesRating = ratingFilter === "Todas" || course.rating >= Number(ratingFilter);
      const matchesPrice = priceFilter === "Todas" || course.precio <= Number(priceFilter);
      return matchesSearch && matchesCategory && matchesRating && matchesPrice;
    })
  ), [categoryFilter, courses, priceFilter, ratingFilter, searchTerm]);

  const recommendedCourses = useMemo(() => filteredCourses.filter((course) => CATEGORY_SHORTCUTS.includes(course.categoria) || course.rating >= 4.7).slice(0, 6), [filteredCourses]);
  const popularCourses = useMemo(() => [...filteredCourses].sort((left, right) => {
    if (right.estudiantes_count !== left.estudiantes_count) {
      return right.estudiantes_count - left.estudiantes_count;
    }
    return right.rating - left.rating;
  }), [filteredCourses]);

  const purchasedCourses = useMemo(() => courses.filter((course) => purchasedCourseIds.includes(course.id)), [courses, purchasedCourseIds]);
  const creatorCourses = useMemo(() => courses.filter((course) => course.importadora_nombre === companyName), [companyName, courses]);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;
  const playerCourse = courses.find((course) => course.id === activePlayerCourseId) || null;
  const playerLessons = flattenLessons(playerCourse);
  const activeLesson = playerLessons.find((lesson) => lesson.id === activeLessonId) || playerLessons[0] || null;

  const purchasedCoursesByRecent = useMemo(() => sortByRecent(purchasedCourses, learningState.recentCourseIds), [learningState.recentCourseIds, purchasedCourses]);
  const progressByCourseId = useMemo(() => Object.fromEntries(purchasedCourses.map((course) => [course.id, getProgressPercentage(course, completedLessonsByCourse[course.id] || [])])), [completedLessonsByCourse, purchasedCourses]);
  const inProgressCourses = useMemo(() => purchasedCoursesByRecent.filter((course) => {
    const progress = progressByCourseId[course.id] || 0;
    return progress > 0 && progress < 100;
  }), [progressByCourseId, purchasedCoursesByRecent]);
  const completedCourses = useMemo(() => purchasedCoursesByRecent.filter((course) => (progressByCourseId[course.id] || 0) === 100), [progressByCourseId, purchasedCoursesByRecent]);
  const continueCourse = useMemo(() => {
    if (learningState.lastCourseId) {
      return purchasedCourses.find((course) => course.id === learningState.lastCourseId) || null;
    }
    return inProgressCourses[0] || purchasedCoursesByRecent[0] || null;
  }, [inProgressCourses, learningState.lastCourseId, purchasedCourses, purchasedCoursesByRecent]);
  const continueLessonId = continueCourse ? learningState.lastLessonIdByCourse[continueCourse.id] || flattenLessons(continueCourse)[0]?.id || null : null;
  const continueCompletedIds = continueCourse ? completedLessonsByCourse[continueCourse.id] || [] : [];
  const continueProgress = continueCourse ? getProgressPercentage(continueCourse, continueCompletedIds) : 0;
  const nextLesson = continueCourse ? getNextLesson(continueCourse, continueLessonId, continueCompletedIds) : null;
  const playerProgress = playerCourse ? getProgressPercentage(playerCourse, completedLessonsByCourse[playerCourse.id] || []) : 0;

  useEffect(() => {
    if (!activePlayerCourseId && purchasedCourses.length > 0) {
      setActivePlayerCourseId(learningState.lastCourseId || purchasedCourses[0].id);
    }
  }, [activePlayerCourseId, learningState.lastCourseId, purchasedCourses]);

  useEffect(() => {
    if (!playerCourse) {
      setActiveLessonId(null);
      return;
    }

    const rememberedLessonId = learningState.lastLessonIdByCourse[playerCourse.id];
    const lessons = flattenLessons(playerCourse);
    if (!lessons.some((lesson) => lesson.id === activeLessonId)) {
      setActiveLessonId(rememberedLessonId && lessons.some((lesson) => lesson.id === rememberedLessonId) ? rememberedLessonId : lessons[0]?.id ?? null);
    }
  }, [activeLessonId, learningState.lastLessonIdByCourse, playerCourse]);

  useEffect(() => {
    if (playerCourse && activeLesson) {
      markLessonViewed(playerCourse.id, activeLesson.id);
    }
  }, [activeLesson, markLessonViewed, playerCourse]);

  function handleOpenPlayer(courseId: string, lessonId?: string | null): void {
    setMainTab("mine");
    setActivePlayerCourseId(courseId);
    if (lessonId) {
      setActiveLessonId(lessonId);
    }
  }

  function handlePurchase(courseId: string): void {
    purchaseCourse(courseId);
    const course = courses.find((item) => item.id === courseId) || null;
    setSelectedCourseId(null);
    setMainTab("mine");
    setActivePlayerCourseId(courseId);
    setActiveLessonId(flattenLessons(course)[0]?.id ?? null);
  }

  function handlePublish(): void {
    const nextCourse = toPublishInput(publishForm, companyName || "Mi empresa importadora");
    if (!nextCourse.value) {
      setPublishError(nextCourse.error);
      return;
    }

    publishCourse(nextCourse.value);
    setPublishForm({ ...INITIAL_PUBLISH_FORM, modulos: [createDraftModule()] });
    setPublishError("");
    setShowPublishModal(false);
  }

  function updateModule(moduleId: string, updater: (module: DraftModule) => DraftModule): void {
    setPublishForm((current) => ({
      ...current,
      modulos: current.modulos.map((module) => module.id === moduleId ? updater(module) : module),
    }));
  }

  function addModule(): void {
    setPublishForm((current) => ({
      ...current,
      modulos: [...current.modulos, createDraftModule()],
    }));
  }

  function removeModule(moduleId: string): void {
    setPublishForm((current) => ({
      ...current,
      modulos: current.modulos.filter((module) => module.id !== moduleId),
    }));
  }

  function addLesson(moduleId: string): void {
    updateModule(moduleId, (module) => ({
      ...module,
      lecciones: [...module.lecciones, createDraftLesson()],
    }));
  }

  function removeLesson(moduleId: string, lessonId: string): void {
    updateModule(moduleId, (module) => ({
      ...module,
      lecciones: module.lecciones.filter((lesson) => lesson.id !== lessonId),
    }));
  }

  function updateLesson(moduleId: string, lessonId: string, updater: (lesson: DraftLesson) => DraftLesson): void {
    updateModule(moduleId, (module) => ({
      ...module,
      lecciones: module.lecciones.map((lesson) => lesson.id === lessonId ? updater(lesson) : lesson),
    }));
  }

  function addResource(moduleId: string, lessonId: string): void {
    updateLesson(moduleId, lessonId, (lesson) => ({
      ...lesson,
      recursos: [...lesson.recursos, createDraftResource()],
    }));
  }

  function removeResource(moduleId: string, lessonId: string, resourceId: string): void {
    updateLesson(moduleId, lessonId, (lesson) => ({
      ...lesson,
      recursos: lesson.recursos.filter((resource) => resource.id !== resourceId),
    }));
  }

  const totalCreatorStudents = creatorCourses.reduce((sum, course) => sum + course.estudiantes_count, 0);
  const totalCreatorRevenue = creatorCourses.reduce((sum, course) => sum + (course.precio * course.estudiantes_count), 0);

  const renderCourseGrid = (rows: Course[]) => (
    <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {rows.map((course) => {
        const isPurchased = purchasedCourseIds.includes(course.id);
        const progress = progressByCourseId[course.id] || 0;

        return (
          <Card key={course.id} className="overflow-hidden gap-0">
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img
                src={course.portada_url}
                alt={course.titulo}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = IMAGE_FALLBACK;
                }}
              />
            </div>
            <CardHeader className="gap-3 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold">{course.titulo}</CardTitle>
                  <CardDescription className="mt-1 text-sm">{course.importadora_nombre}</CardDescription>
                </div>
                <Badge variant="outline">{course.nivel}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{course.categoria}</Badge>
                <Badge variant="outline">
                  <Star className="size-3 fill-current" />
                  {course.rating.toFixed(1)}
                </Badge>
                <Badge variant="outline">
                  <Users className="size-3" />
                  {course.estudiantes_count}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <p className="line-clamp-3 text-sm text-muted-foreground">{course.descripcion}</p>
              {isPurchased ? (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{progress}% completado</p>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="items-center justify-between gap-3 border-t">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Precio</p>
                <p className="text-lg font-semibold">{formatCurrency(course.precio)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedCourseId(course.id)}>
                  Ver detalle
                </Button>
                {isPurchased ? (
                  <Button onClick={() => handleOpenPlayer(course.id, learningState.lastLessonIdByCourse[course.id])}>Continuar</Button>
                ) : null}
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </section>
  );

  return (
    <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <button onClick={onGoDashboard} className="text-sm text-primary hover:underline">
            Volver al panel
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cursos y capacitacion</h1>
            <p className="text-sm text-muted-foreground">
              {role === "solicitante"
                ? "Explora cursos, continua clases con progreso local y descarga recursos multimedia por leccion."
                : "Publica cursos con modulos, videos y materiales descargables sin tocar el backend."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Card className="min-w-[170px] gap-3 border-primary/15 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Catalogo</p>
              <div className="mt-2 flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <span className="text-2xl font-semibold">{courses.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-[170px] gap-3">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {role === "solicitante" ? "Mis cursos" : "Mis alumnos"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {role === "solicitante" ? <GraduationCap className="size-4 text-primary" /> : <Users className="size-4 text-primary" />}
                <span className="text-2xl font-semibold">{role === "solicitante" ? purchasedCourses.length : totalCreatorStudents}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {role === "solicitante" ? (
        <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as "all" | "mine")} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-white p-1 shadow-sm sm:w-fit">
            <TabsTrigger value="all">Todos los cursos</TabsTrigger>
            <TabsTrigger value="mine">Mis cursos</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr]">
              <div className="xl:col-span-1">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por curso, categoria o importadora"
                  className="pl-10"
                />
                <Search className="pointer-events-none relative -mt-7 ml-3 size-4 text-muted-foreground" />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Rating minimo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas las valoraciones</SelectItem>
                  <SelectItem value="4">4.0 o mas</SelectItem>
                  <SelectItem value="4.5">4.5 o mas</SelectItem>
                  <SelectItem value="4.8">4.8 o mas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Precio maximo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todos los precios</SelectItem>
                  <SelectItem value="150">Hasta USD 150</SelectItem>
                  <SelectItem value="200">Hasta USD 200</SelectItem>
                  <SelectItem value="250">Hasta USD 250</SelectItem>
                </SelectContent>
              </Select>
            </section>

            <Tabs value={exploreTab} onValueChange={(value) => setExploreTab(value as "recommended" | "popular" | "categories")} className="space-y-5">
              <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-white p-1 shadow-sm sm:w-fit">
                <TabsTrigger value="recommended"><Sparkles className="size-4" />Para ti</TabsTrigger>
                <TabsTrigger value="popular"><Flame className="size-4" />Tendencias</TabsTrigger>
                <TabsTrigger value="categories"><LibraryBig className="size-4" />Por categorias</TabsTrigger>
              </TabsList>

              <TabsContent value="recommended" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Recomendados para comercio exterior</h2>
                    <p className="text-sm text-muted-foreground">Curaduria de temas con mayor valor practico para importadores en operacion.</p>
                  </div>
                </div>
                {renderCourseGrid(recommendedCourses.length > 0 ? recommendedCourses : filteredCourses)}
              </TabsContent>

              <TabsContent value="popular" className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Mas populares</h2>
                  <p className="text-sm text-muted-foreground">Ordenados por alumnos y rating.</p>
                </div>
                {renderCourseGrid(popularCourses)}
              </TabsContent>

              <TabsContent value="categories" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant={categoryFilter === "Todas" ? "default" : "outline"} onClick={() => setCategoryFilter("Todas")}>Todas</Button>
                  {CATEGORY_SHORTCUTS.map((category) => (
                    <Button key={category} variant={categoryFilter === category ? "default" : "outline"} onClick={() => setCategoryFilter(category)}>
                      {category}
                    </Button>
                  ))}
                </div>
                {renderCourseGrid(filteredCourses)}
              </TabsContent>
            </Tabs>

            {filteredCourses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No hay cursos para los filtros actuales.
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="mine" className="space-y-6">
            <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-primary/10 via-white to-white shadow-sm">
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div className="space-y-4">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">Continuar aprendiendo</Badge>
                  {continueCourse ? (
                    <>
                      <div>
                        <h2 className="text-2xl font-semibold">{continueCourse.titulo}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{continueCourse.importadora_nombre} · {continueCourse.categoria}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 overflow-hidden rounded-full bg-white/70">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${continueProgress}%` }} />
                        </div>
                        <p className="text-sm text-muted-foreground">{continueProgress}% completado</p>
                      </div>
                      <div className="rounded-2xl border bg-white/70 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Siguiente clase</p>
                        <p className="mt-2 text-lg font-semibold">{nextLesson?.titulo || "Listo para repasar"}</p>
                        <p className="text-sm text-muted-foreground">{nextLesson?.duracion || "Sin duracion"}</p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-semibold">Aun no has iniciado un curso</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Compra uno desde el catalogo para desbloquear el acceso rapido.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white">
                  <div className="flex items-center gap-3">
                    <CirclePlay className="size-10 text-primary-foreground" />
                    <div>
                      <p className="text-sm text-white/70">Acceso de un clic</p>
                      <p className="text-xl font-semibold">Ir a la clase</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/70">Abre el reproductor exactamente en el curso y leccion vistos recientemente.</p>
                  <Button className="w-full bg-white text-slate-950 hover:bg-white/90" onClick={() => continueCourse ? handleOpenPlayer(continueCourse.id, continueLessonId) : setMainTab("all")}>
                    {continueCourse ? "Ir a la clase" : "Explorar cursos"}
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Vistos recientemente / En progreso</h2>
                <p className="text-sm text-muted-foreground">Tus cursos iniciados se ordenan segun la ultima actividad guardada en localStorage.</p>
              </div>
              {inProgressCourses.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {inProgressCourses.map((course) => (
                    <Card key={course.id} className="gap-0 overflow-hidden">
                      <div className="aspect-[16/9] overflow-hidden bg-muted">
                        <img src={course.portada_url} alt={course.titulo} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }} />
                      </div>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base font-semibold">{course.titulo}</CardTitle>
                            <CardDescription className="mt-1">{course.importadora_nombre}</CardDescription>
                          </div>
                          <TrendingUp className="size-4 text-primary" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${progressByCourseId[course.id] || 0}%` }} />
                        </div>
                        <p className="text-sm text-muted-foreground">{progressByCourseId[course.id] || 0}% completado</p>
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full" onClick={() => handleOpenPlayer(course.id, learningState.lastLessonIdByCourse[course.id])}>Continuar curso</Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Aun no tienes cursos en progreso.
                  </CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Completados</h2>
                <p className="text-sm text-muted-foreground">Cursos con 100% de lecciones marcadas.</p>
              </div>
              {completedCourses.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {completedCourses.map((course) => (
                    <Card key={course.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base font-semibold">{course.titulo}</CardTitle>
                            <CardDescription className="mt-1">{course.importadora_nombre}</CardDescription>
                          </div>
                          <Badge variant="secondary">100%</Badge>
                        </div>
                      </CardHeader>
                      <CardFooter>
                        <Button className="w-full" variant="outline" onClick={() => handleOpenPlayer(course.id, learningState.lastLessonIdByCourse[course.id])}>Revisar curso</Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Ningun curso completado todavia.
                  </CardContent>
                </Card>
              )}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <Card className="gap-0 overflow-hidden">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg font-semibold">Reproductor / Mis cursos</CardTitle>
                  <CardDescription>
                    {playerCourse
                      ? `Continua el curso ${playerCourse.titulo} y abre sus materiales descargables.`
                      : "Compra un curso para habilitar el reproductor y el seguimiento de progreso."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {playerCourse && activeLesson ? (
                    <>
                      <div className="overflow-hidden rounded-xl border bg-slate-950 shadow-sm">
                        <div className="aspect-video">
                          {isEmbeddableVideo(activeLesson.video_url) ? (
                            <iframe
                              src={activeLesson.video_url}
                              title={activeLesson.titulo}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <video src={activeLesson.video_url} controls className="h-full w-full" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Leccion actual</p>
                            <h3 className="text-xl font-semibold">{activeLesson.titulo}</h3>
                          </div>
                          <Badge variant="outline">{activeLesson.duracion}</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${playerProgress}%` }} />
                          </div>
                          <p className="text-sm text-muted-foreground">Progreso guardado localmente: {playerProgress}%</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
                      <CirclePlay className="size-10 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Aun no tienes un curso activo</p>
                        <p className="text-sm text-muted-foreground">Compra un curso del catalogo y vuelve aqui para empezar.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0 overflow-hidden">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg font-semibold">Lecciones y recursos</CardTitle>
                  <CardDescription>Sidebar con progreso y materiales descargables de la clase activa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  {playerCourse ? (
                    <>
                      <div className="space-y-3">
                        {playerLessons.map((lesson, index) => {
                          const completed = (completedLessonsByCourse[playerCourse.id] || []).includes(lesson.id);
                          return (
                            <div
                              key={lesson.id}
                              className={clsx(
                                "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                                activeLesson?.id === lesson.id ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                              )}
                            >
                              <Checkbox
                                checked={completed}
                                onCheckedChange={(checked) => toggleLessonCompleted(playerCourse.id, lesson.id, checked === true)}
                                className="mt-1"
                              />
                              <button className="flex-1 text-left" onClick={() => setActiveLessonId(lesson.id)}>
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Leccion {index + 1}</p>
                                <p className="font-medium">{lesson.titulo}</p>
                                <p className="text-sm text-muted-foreground">{lesson.duracion}</p>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="size-4 text-primary" />
                          <h3 className="font-semibold">Recursos de esta clase</h3>
                        </div>
                        {activeLesson?.recursos.length ? (
                          <div className="space-y-2">
                            {activeLesson.recursos.map((resource) => (
                              <Button key={resource.id} variant="outline" className="w-full justify-between" asChild>
                                <a href={resource.url} target="_blank" rel="noreferrer">
                                  <span className="flex items-center gap-2 truncate">
                                    <FileDown className="size-4" />
                                    <span className="truncate">{resource.nombre}</span>
                                  </span>
                                  <Badge variant="secondary" className="capitalize">{resource.tipo}</Badge>
                                </a>
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Esta leccion no tiene adjuntos todavia.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Las lecciones apareceran cuando selecciones un curso comprado.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Cursos publicados</CardDescription>
                <CardTitle className="text-3xl font-semibold">{creatorCourses.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Alumnos acumulados</CardDescription>
                <CardTitle className="text-3xl font-semibold">{totalCreatorStudents}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Ingresos simulados</CardDescription>
                <CardTitle className="text-3xl font-semibold">{formatCurrency(totalCreatorRevenue)}</CardTitle>
              </CardHeader>
            </Card>
          </section>

          <Card className="gap-0 overflow-hidden">
            <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Tablero del creador</CardTitle>
                <CardDescription>{companyName || "Mi empresa importadora"}</CardDescription>
              </div>
              <Button onClick={() => setShowPublishModal(true)}>
                <Plus className="size-4" />
                Publicar nuevo curso
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Curso</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Alumnos</TableHead>
                    <TableHead>Ingresos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creatorCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="whitespace-normal">
                        <div>
                          <p className="font-medium">{course.titulo}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(course.precio)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{course.categoria}</TableCell>
                      <TableCell>{course.nivel}</TableCell>
                      <TableCell>{course.estudiantes_count}</TableCell>
                      <TableCell>{formatCurrency(course.estudiantes_count * course.precio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {creatorCourses.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Todavia no has publicado cursos. Usa el modal para crear el primero.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={Boolean(selectedCourse)} onOpenChange={(open) => setSelectedCourseId(open ? selectedCourseId : null)}>
        <DialogContent className="max-w-4xl">
          {selectedCourse ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCourse.titulo}</DialogTitle>
                <DialogDescription>
                  {selectedCourse.importadora_nombre} · {selectedCourse.categoria}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border bg-slate-950">
                    <div className="aspect-video">
                      {isEmbeddableVideo(flattenLessons(selectedCourse)[0]?.video_url || "") ? (
                        <iframe
                          src={flattenLessons(selectedCourse)[0]?.video_url}
                          title={`Trailer de ${selectedCourse.titulo}`}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video src={flattenLessons(selectedCourse)[0]?.video_url} controls className="h-full w-full" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedCourse.descripcion}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{selectedCourse.nivel}</Badge>
                    <Badge variant="outline">
                      <Star className="size-3 fill-current" />
                      {selectedCourse.rating.toFixed(1)}
                    </Badge>
                    <Badge variant="outline">
                      <Users className="size-3" />
                      {selectedCourse.estudiantes_count}
                    </Badge>
                  </div>

                  <Accordion type="multiple" className="rounded-xl border px-4">
                    {selectedCourse.modulos.map((module) => (
                      <AccordionItem key={module.id} value={module.id}>
                        <AccordionTrigger>
                          <div>
                            <p className="font-medium">{module.titulo}</p>
                            <p className="text-xs text-muted-foreground">{module.lecciones.length} lecciones</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {module.lecciones.map((lesson) => (
                              <div key={lesson.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                <p className="font-medium">{lesson.titulo}</p>
                                <p className="text-xs text-muted-foreground">{lesson.duracion} · {lesson.recursos.length} recursos</p>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Precio del curso</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrency(selectedCourse.precio)}</p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedCourseId(null)}>Cerrar</Button>
                {purchasedCourseIds.includes(selectedCourse.id) ? (
                  <Button onClick={() => { setSelectedCourseId(null); handleOpenPlayer(selectedCourse.id, learningState.lastLessonIdByCourse[selectedCourse.id]); }}>
                    Ir a mi curso
                  </Button>
                ) : (
                  <Button onClick={() => handlePurchase(selectedCourse.id)}>
                    <Coins className="size-4" />
                    Comprar curso
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="sm:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Publicar nuevo curso</DialogTitle>
            <DialogDescription>
              Crea módulos, lecciones, enlaces multimedia y recursos descargables. Todo se guarda localmente.
            </DialogDescription>
          </DialogHeader>

          {/* Grilla dividida en 5 columnas principales */}
          <div className="grid gap-6 lg:grid-cols-5">
            
            {/* COLUMNA IZQUIERDA (40%): ocupa 2 columnas de 5 */}
            <div className="space-y-4 lg:col-span-2 border-r lg:pr-6">
              <h3 className="text-sm font-semibold border-b pb-2">Información del curso</h3>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Título</p>
                <Input 
                  value={publishForm.titulo} 
                  onChange={(event) => setPublishForm((current) => ({ ...current, titulo: event.target.value }))} 
                  placeholder="Ej. Dominando consolidaciones LCL" 
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Descripción</p>
                <Textarea 
                  rows={4}
                  value={publishForm.descripcion} 
                  onChange={(event) => setPublishForm((current) => ({ ...current, descripcion: event.target.value }))} 
                  placeholder="Describe el valor del curso y el resultado esperado." 
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Categoría</p>
                  <Input 
                    value={publishForm.categoria} 
                    onChange={(event) => setPublishForm((current) => ({ ...current, categoria: event.target.value }))} 
                    placeholder="Logística, Aduanas..." 
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Precio</p>
                  <Input 
                    type="number" 
                    min="1" 
                    value={publishForm.precio} 
                    onChange={(event) => setPublishForm((current) => ({ ...current, precio: event.target.value }))} 
                    placeholder="199" 
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Nivel</p>
                  <Select value={publishForm.nivel} onValueChange={(value) => setPublishForm((current) => ({ ...current, nivel: value as CourseLevel }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Principiante">Principiante</SelectItem>
                      <SelectItem value="Avanzado">Avanzado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Imagen (URL)</p>
                  <Input 
                    value={publishForm.portada_url} 
                    onChange={(event) => setPublishForm((current) => ({ ...current, portada_url: event.target.value }))} 
                    placeholder="https://..." 
                  />
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA (60%): ocupa 3 columnas de 5 */}
            <div className="space-y-4 lg:col-span-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <div>
                  <p className="text-sm font-semibold">Temario del curso</p>
                  <p className="text-xs text-muted-foreground">Módulos, lecciones y recursos.</p>
                </div>
                <Button variant="outline" size="sm" onClick={addModule}>
                  <Plus className="size-4 mr-1" />
                  Agregar módulo
                </Button>
              </div>

              {/* Scroll independiente para el temario */}
              <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2 flex-1">
                {publishForm.modulos.map((module, moduleIndex) => (
                  <Card key={module.id} className="gap-4 border-dashed">
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Módulo {moduleIndex + 1}</p>
                          <Input
                            value={module.titulo}
                            onChange={(event) => updateModule(module.id, (current) => ({ ...current, titulo: event.target.value }))}
                            placeholder="Título del módulo"
                          />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => removeModule(module.id)} disabled={publishForm.modulos.length === 1}>
                          Eliminar
                        </Button>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 pt-4">
                      {module.lecciones.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">Lección {lessonIndex + 1}</p>
                            <Button variant="ghost" size="sm" onClick={() => removeLesson(module.id, lesson.id)} disabled={module.lecciones.length === 1}>
                              Eliminar lección
                            </Button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-medium">Título</p>
                              <Input
                                value={lesson.titulo}
                                onChange={(event) => updateLesson(module.id, lesson.id, (current) => ({ ...current, titulo: event.target.value }))}
                                placeholder="Ej. Checklist documental..."
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Duración</p>
                              <Input
                                value={lesson.duracion}
                                onChange={(event) => updateLesson(module.id, lesson.id, (current) => ({ ...current, duracion: event.target.value }))}
                                placeholder="12 min"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-3">
                              <p className="text-xs font-medium">Enlace vídeo</p>
                              <Input
                                value={lesson.video_url}
                                onChange={(event) => updateLesson(module.id, lesson.id, (current) => ({ ...current, video_url: event.target.value }))}
                                placeholder="https://..."
                              />
                            </div>
                          </div>

                          {/* Recurso adjunto */}
                          <div className="space-y-2 rounded-lg border bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium">Recursos adjuntos</p>
                              <Button variant="outline" size="sm" onClick={() => addResource(module.id, lesson.id)}>
                                <Plus className="size-3 mr-1" />
                                Agregar
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {lesson.recursos.map((resource) => (
                                <div key={resource.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                                  <Input
                                    value={resource.nombre}
                                    onChange={(event) => updateLesson(module.id, lesson.id, (current) => ({
                                      ...current,
                                      recursos: current.recursos.map((item) => item.id === resource.id ? { ...item, nombre: event.target.value } : item),
                                    }))}
                                    placeholder="Nombre del archivo"
                                  />
                                  <Input
                                    value={resource.url}
                                    onChange={(event) => updateLesson(module.id, lesson.id, (current) => ({
                                      ...current,
                                      recursos: current.recursos.map((item) => item.id === resource.id ? { ...item, url: event.target.value } : item),
                                    }))}
                                    placeholder="URL del recurso"
                                  />
                                  <Select
                                    value={resource.tipo}
                                    onValueChange={(value) => updateLesson(module.id, lesson.id, (current) => ({
                                      ...current,
                                      recursos: current.recursos.map((item) => item.id === resource.id ? { ...item, tipo: value as ResourceType } : item),
                                    }))}
                                  >
                                    <SelectTrigger className="w-[110px]">
                                      <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="archivo">Archivo</SelectItem>
                                      <SelectItem value="plantilla">Plantilla</SelectItem>
                                      <SelectItem value="checklist">Checklist</SelectItem>
                                      <SelectItem value="guia">Guía</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button variant="outline" size="sm" onClick={() => removeResource(module.id, lesson.id, resource.id)} disabled={lesson.recursos.length === 1}>
                                    Quitar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button variant="outline" size="sm" onClick={() => addLesson(module.id)}>
                        <Plus className="size-4 mr-1" />
                        Agregar lección
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

          </div>

          {publishError ? <p className="text-sm text-destructive">{publishError}</p> : null}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPublishModal(false)}>Cancelar</Button>
            <Button onClick={handlePublish}>Publicar curso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}