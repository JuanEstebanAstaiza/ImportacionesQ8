import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  ChevronRight,
  CirclePlay,
  Coins,
  Pencil,
  FileDown,
  Flame,
  FolderKanban,
  GraduationCap,
  LibraryBig,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { clsx } from "clsx";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";
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
import { isSafeHttpUrl, safeHttpUrl } from "@/utils/safe-url";
import { getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { coursesService } from "@/services/courses.service";
import {
  businessService,
  type BackendArchivoItem,
  type BackendExplorerResponse,
} from "@/services/business.service";
import { formatearTamano, obtenerLimiteSubida } from "@/lib/limite-subida";

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
  /** Id local, solo para claves de React y reordenamiento en la lista. */
  id: string;
  /**
   * Id real de la lección en el backend, presente solo al editar un curso ya
   * publicado. Hay que devolverlo para que el backend reconozca la lección y no
   * borre el progreso que los alumnos ya tenían sobre ella.
   */
  serverId?: string;
  titulo: string;
  duracion: string;
  video_url: string;
  recursos: DraftResource[];
};

type DraftModule = {
  id: string;
  serverId?: string;
  titulo: string;
  lecciones: DraftLesson[];
};

type DocumentTarget =
  | { kind: "resource"; moduleId: string; lessonId: string; resourceId: string }
  | { kind: "video"; moduleId: string; lessonId: string }
  | { kind: "cover" };

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
    video_url: "",
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

function draftFormFromCourse(course: Course): PublishFormState {
  return {
    titulo: course.titulo,
    descripcion: course.descripcion,
    portada_url: course.portada_url || "",
    precio: String(course.precio),
    nivel: course.nivel,
    categoria: course.categoria,
    modulos: course.modulos.length > 0
      ? course.modulos.map((module) => ({
          id: createTempId("module"),
          serverId: module.id,
          titulo: module.titulo,
          lecciones: module.lecciones.length > 0
            ? module.lecciones.map((lesson) => ({
                id: createTempId("lesson"),
                serverId: lesson.id,
                titulo: lesson.titulo,
                duracion: lesson.duracion,
                video_url: lesson.video_url,
                recursos: lesson.recursos.length > 0
                  ? lesson.recursos.map((resource) => ({
                      id: createTempId("resource"),
                      nombre: resource.nombre,
                      url: resource.url,
                      tipo: resource.tipo,
                    }))
                  : [createDraftResource()],
              }))
            : [createDraftLesson()],
        }))
      : [createDraftModule()],
  };
}

function moveArrayItem<T>(rows: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

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

/**
 * Toda URL guardada (relativa, con prefijo `/api`, o absoluta hacia localhost:5173
 * / localhost:8000 de entornos previos) se resuelve contra el backend alcanzable
 * desde este browser. Ver `resolveApiUrl` en services/api-client.
 */
function normalizeVideoUrl(value: string | null | undefined): string {
  return resolveApiUrl(value);
}

/**
 * La descarga del backend exige Authorization, así que un enlace directo daría
 * 401. Se resuelve la ruta, se descarga con token y se abre desde un blob.
 * Los recursos externos (CDN) se abren tal cual, sin enviarles nuestro token.
 */
async function openResourceInNewTab(value: string | null | undefined): Promise<boolean> {
  const canonical = toApiPath(value);
  if (!canonical) {
    return false;
  }

  const target = resolveApiUrl(canonical);
  const token = getStoredToken();
  const isBackendResource = canonical.startsWith("/");

  if (!isBackendResource || !token) {
    window.open(target, "_blank", "noopener,noreferrer");
    return true;
  }

  // Se abre la pestaña antes del await para no chocar con el bloqueo de popups.
  const popup = window.open("about:blank", "_blank");

  try {
    const response = await fetch(target, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      popup?.close();
      return false;
    }

    const objectUrl = window.URL.createObjectURL(await response.blob());
    if (popup) {
      popup.location.replace(objectUrl);
    } else {
      window.open(objectUrl, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  } catch {
    popup?.close();
    return false;
  }
}

function resolvePlayableVideoSource(url: string):
  | { kind: "video"; src: string }
  | null {
  const normalized = normalizeVideoUrl(url);
  if (isSafeHttpUrl(normalized)) {
    return { kind: "video", src: normalized };
  }

  return null;
}

/**
 * Contenedores que gestión documental acepta y que un <video> reproduce de
 * forma nativa. Debe coincidir con `VIDEO_EXTENSIONS` del backend: si aquí se
 * ofrece un formato que allá se rechaza, la subida falla y el archivo nunca
 * aparece en Documentos.
 */
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];
const VIDEO_FORMATS_LABEL = "MP4, WebM, MOV o M4V";
const VIDEO_UPLOAD_ACCEPT = ".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime,video/x-m4v";

type VideoLoadError = "forbidden" | "missing" | "network";

const VIDEO_ERROR_MESSAGE: Record<VideoLoadError, string> = {
  forbidden: "No tienes acceso a este video. Inscríbete en el curso para verlo completo.",
  missing: "El archivo del video ya no está disponible en gestión documental.",
  network: "No se pudo contactar al servidor para cargar el video.",
};

function ProtectedVideoPlayer({ url, onEnded }: { url: string; onEnded?: () => void }) {
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [loadError, setLoadError] = useState<VideoLoadError | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isCancelled = false;

    async function loadVideo(): Promise<void> {
      setLoadError(null);
      setMediaUrl("");

      const absoluteUrl = normalizeVideoUrl(url);
      if (!absoluteUrl) {
        setLoadError("missing");
        return;
      }

      try {
        // Portadas y lecciones de vista previa son públicas en el backend: si
        // responde sin token se usa la URL directa, que conserva la búsqueda
        // por Range en vez de descargar el archivo entero.
        const publicProbe = await fetch(absoluteUrl, { headers: { Range: "bytes=0-0" } });
        if (publicProbe.ok) {
          if (!isCancelled) {
            setMediaUrl(absoluteUrl);
          }
          return;
        }

        // Para el material de pago hay que mandar Authorization, y un
        // <video src> no puede llevar cabeceras: se descarga y se reproduce
        // desde un blob. Nunca se cae a la URL cruda, que volvería a dar 401.
        const token = getStoredToken();
        const response = token
          ? await fetch(absoluteUrl, { headers: { Authorization: `Bearer ${token}` } })
          : publicProbe;

        if (!response.ok) {
          if (!isCancelled) {
            setLoadError(response.status === 404 ? "missing" : "forbidden");
          }
          return;
        }

        const blob = await response.blob();
        objectUrl = window.URL.createObjectURL(blob);
        if (!isCancelled) {
          setMediaUrl(objectUrl);
        }
      } catch {
        if (!isCancelled) {
          setLoadError("network");
        }
      }
    }

    void loadVideo();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {VIDEO_ERROR_MESSAGE[loadError]}
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Cargando video...
      </div>
    );
  }

  return (
    <video
      src={mediaUrl}
      controls
      playsInline
      preload="metadata"
      className="h-full w-full"
      onEnded={onEnded}
    />
  );
}

/**
 * Se valida contra la URL resuelta (http/https real) pero se persiste la forma
 * canónica: ruta del backend para recursos propios, URL absoluta para externos.
 */
function toStorableResourceUrl(value: string | null | undefined): { canonical: string; resolved: string } {
  const canonical = toApiPath(value);
  if (!canonical.startsWith("/documentos/archivos/")) {
    return { canonical: "", resolved: "" };
  }
  return { canonical, resolved: resolveApiUrl(canonical) };
}

function toPublishInput(form: PublishFormState): { value: PublishCourseInput | null; error: string } {
  const precio = Number(form.precio);
  const portada = toStorableResourceUrl(form.portada_url);

  if (!form.titulo.trim() || !form.descripcion.trim() || !portada.canonical || !form.categoria.trim()) {
    return { value: null, error: "Completa titulo, descripcion, categoria e imagen del curso." };
  }

  if (!isSafeHttpUrl(portada.resolved)) {
    return { value: null, error: "La portada debe apuntar a un recurso http(s) válido." };
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
      const video = toStorableResourceUrl(lesson.video_url);

      if (!lesson.titulo.trim() || !lesson.duracion.trim() || !video.canonical) {
        return { value: null, error: "Cada leccion debe incluir titulo, duracion y video subido." };
      }

      if (!isSafeHttpUrl(video.resolved)) {
        return { value: null, error: "El video debe apuntar a un recurso http(s) válido." };
      }

      const resources = [] as PublishLessonResourceInput[];
      for (const resource of lesson.recursos) {
        const hasName = Boolean(resource.nombre.trim());
        const hasUrl = Boolean(resource.url.trim());

        if (hasName !== hasUrl) {
          return { value: null, error: "Cada recurso debe tener nombre y URL, o dejarse vacio para ignorarlo." };
        }

        if (hasName && hasUrl) {
          const normalizedResource = toStorableResourceUrl(resource.url);
          if (!isSafeHttpUrl(normalizedResource.resolved)) {
            return { value: null, error: "Cada recurso debe apuntar a un recurso http(s) válido." };
          }

          resources.push({
            nombre: resource.nombre.trim(),
            url: normalizedResource.canonical,
            tipo: resource.tipo,
          });
        }
      }

      lessons.push({
        ...(lesson.serverId ? { id: lesson.serverId } : {}),
        titulo: lesson.titulo.trim(),
        duracion: lesson.duracion.trim(),
        video_url: video.canonical,
        recursos: resources,
      });
    }

    modules.push({
      ...(module.serverId ? { id: module.serverId } : {}),
      titulo: module.titulo.trim(),
      lecciones: lessons,
    });
  }

  return {
    value: {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      portada_url: portada.canonical,
      precio,
      nivel: form.nivel,
      categoria: form.categoria.trim(),
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
    isLoading,
    isFetchingDetail,
    isSavingProgress,
    error,
    fetchCourseDetail,
    purchaseCourse,
    publishCourse,
    updateCourse,
    deleteCourse,
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
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [publishForm, setPublishForm] = useState<PublishFormState>(INITIAL_PUBLISH_FORM);
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [resourcePickerTarget, setResourcePickerTarget] = useState<DocumentTarget | null>(null);
  const [resourceUploadTarget, setResourceUploadTarget] = useState<DocumentTarget | null>(null);
  const [resourceUploadAccept, setResourceUploadAccept] = useState("*/*");
  const [resourceExplorer, setResourceExplorer] = useState<BackendExplorerResponse>({ carpetas: [], archivos: [] });
  const [resourceCurrentFolderId, setResourceCurrentFolderId] = useState<string | null>(null);
  const [resourceFolderTrail, setResourceFolderTrail] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "Raiz" }]);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceSearchResults, setResourceSearchResults] = useState<BackendArchivoItem[] | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceSearching, setResourceSearching] = useState(false);
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [draggingLesson, setDraggingLesson] = useState<{ moduleId: string; lessonId: string } | null>(null);
  const [publishError, setPublishError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [pendingPurchaseCourseId, setPendingPurchaseCourseId] = useState<string | null>(null);
  const finishingLessonRef = useRef<string | null>(null);
  const resourceUploadInputRef = useRef<HTMLInputElement | null>(null);

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
    return progress < 100;
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

  const [isDownloadingCertificate, setIsDownloadingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState("");

  /**
   * Pide el certificado y lo abre. El PDF queda además en la carpeta
   * `Certificados` de la gestión documental del alumno, así que puede volver a
   * descargarlo desde ahí sin pasar por el reproductor.
   */
  const handleDownloadCertificate = useCallback(async (courseId: string) => {
    setCertificateError("");
    setIsDownloadingCertificate(true);
    try {
      const certificado = await coursesService.getCertificate(courseId);
      const abierto = await openResourceInNewTab(certificado.url_descarga);
      if (!abierto) {
        setCertificateError("El certificado se generó, pero no se pudo abrir. Búscalo en Documentos › Certificados.");
      }
    } catch (error) {
      setCertificateError(error instanceof Error && error.message.trim() ? error.message : "No se pudo generar el certificado.");
    } finally {
      setIsDownloadingCertificate(false);
    }
  }, []);

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

  useEffect(() => {
    if (!showPublishModal) {
      setEditingCourseId(null);
      setResourcePickerOpen(false);
      setResourcePickerTarget(null);
      setResourceUploadTarget(null);
      setResourceSearch("");
      setResourceSearchResults(null);
      setResourceFolderTrail([{ id: null, name: "Raiz" }]);
    }
  }, [showPublishModal]);

  function handleOpenPlayer(courseId: string, lessonId?: string | null): void {
    const targetCourse = courses.find((item) => item.id === courseId) || null;
    const fallbackLessonId = lessonId
      || learningState.lastLessonIdByCourse[courseId]
      || flattenLessons(targetCourse)[0]?.id
      || null;

    setMainTab("mine");
    setActivePlayerCourseId(courseId);
    setActiveLessonId(fallbackLessonId);
    setPlayerModalOpen(true);
  }

  const handleVideoFinished = useCallback(async (lessonId?: string | null): Promise<void> => {
    if (!playerCourse) {
      return;
    }

    const targetLessonId = lessonId || activeLesson?.id || null;
    if (!targetLessonId || finishingLessonRef.current === targetLessonId) {
      return;
    }

    finishingLessonRef.current = targetLessonId;

    try {
      const alreadyCompleted = (completedLessonsByCourse[playerCourse.id] || []).includes(targetLessonId);
      if (!alreadyCompleted) {
        await toggleLessonCompleted(playerCourse.id, targetLessonId, true);
      }

      const currentIndex = playerLessons.findIndex((lesson) => lesson.id === targetLessonId);
      const nextLesson = currentIndex >= 0 ? playerLessons[currentIndex + 1] : null;
      if (nextLesson) {
        setActiveLessonId(nextLesson.id);
        markLessonViewed(playerCourse.id, nextLesson.id);
      }
    } finally {
      finishingLessonRef.current = null;
    }
  }, [activeLesson?.id, completedLessonsByCourse, markLessonViewed, playerCourse, playerLessons, toggleLessonCompleted]);

  async function handleOpenCourseDetail(courseId: string): Promise<void> {
    const normalizedCourseId = courseId?.trim();
    if (!normalizedCourseId) {
      setActionError("No se pudo identificar el curso seleccionado.");
      return;
    }

    setActionError("");
    setSelectedCourseId(normalizedCourseId);

    const target = courses.find((row) => row.id === normalizedCourseId) || null;
    if (target?.modulos.length) {
      return;
    }

    try {
      await fetchCourseDetail(normalizedCourseId);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo cargar la información del curso.");
    }
  }

  async function handlePurchase(courseId: string): Promise<void> {
    setActionError("");
    setPendingPurchaseCourseId(courseId);
    try {
      await purchaseCourse(courseId);
      const course = courses.find((item) => item.id === courseId) || null;
      setSelectedCourseId(null);
      setMainTab("mine");
      setActivePlayerCourseId(courseId);
      setActiveLessonId(flattenLessons(course)[0]?.id ?? null);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo completar la inscripción al curso.");
    } finally {
      setPendingPurchaseCourseId(null);
    }
  }

  async function handlePublish(): Promise<void> {
    const nextCourse = toPublishInput(publishForm);
    if (!nextCourse.value) {
      setPublishError(nextCourse.error);
      return;
    }

    setActionError("");
    setIsPublishing(true);
    try {
      if (editingCourseId) {
        await updateCourse(editingCourseId, nextCourse.value);
      } else {
        await publishCourse(nextCourse.value);
      }
      setPublishForm({ ...INITIAL_PUBLISH_FORM, modulos: [createDraftModule()] });
      setPublishError("");
      setEditingCourseId(null);
      setShowPublishModal(false);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo guardar el curso.");
    } finally {
      setIsPublishing(false);
    }
  }

  function handleCreateCourse(): void {
    setEditingCourseId(null);
    setPublishError("");
    setActionError("");
    setPublishForm({ ...INITIAL_PUBLISH_FORM, modulos: [createDraftModule()] });
    setShowPublishModal(true);
  }

  function handleEditCourse(courseId: string): void {
    const course = creatorCourses.find((row) => row.id === courseId) || null;
    if (!course) {
      setActionError("No se encontró el curso a editar.");
      return;
    }
    setEditingCourseId(course.id);
    setPublishError("");
    setActionError("");
    setPublishForm(draftFormFromCourse(course));
    setShowPublishModal(true);
  }

  async function handleDeleteCourse(courseId: string): Promise<void> {
    setActionError("");
    try {
      await deleteCourse(courseId);
      if (selectedCourseId === courseId) {
        setSelectedCourseId(null);
      }
      if (activePlayerCourseId === courseId) {
        setActivePlayerCourseId(null);
        setActiveLessonId(null);
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo eliminar el curso.");
    }
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

  function reorderModule(moduleId: string, direction: "up" | "down"): void {
    setPublishForm((current) => {
      const index = current.modulos.findIndex((module) => module.id === moduleId);
      if (index === -1) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      return {
        ...current,
        modulos: moveArrayItem(current.modulos, index, targetIndex),
      };
    });
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

  function reorderLesson(moduleId: string, lessonId: string, direction: "up" | "down"): void {
    updateModule(moduleId, (module) => {
      const index = module.lecciones.findIndex((lesson) => lesson.id === lessonId);
      if (index === -1) return module;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      return {
        ...module,
        lecciones: moveArrayItem(module.lecciones, index, targetIndex),
      };
    });
  }

  function moveModuleTo(draggedModuleId: string, targetModuleId: string): void {
    setPublishForm((current) => {
      const fromIndex = current.modulos.findIndex((module) => module.id === draggedModuleId);
      const toIndex = current.modulos.findIndex((module) => module.id === targetModuleId);
      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }
      return {
        ...current,
        modulos: moveArrayItem(current.modulos, fromIndex, toIndex),
      };
    });
  }

  function moveLessonTo(moduleId: string, draggedLessonId: string, targetLessonId: string): void {
    updateModule(moduleId, (module) => {
      const fromIndex = module.lecciones.findIndex((lesson) => lesson.id === draggedLessonId);
      const toIndex = module.lecciones.findIndex((lesson) => lesson.id === targetLessonId);
      if (fromIndex === -1 || toIndex === -1) {
        return module;
      }
      return {
        ...module,
        lecciones: moveArrayItem(module.lecciones, fromIndex, toIndex),
      };
    });
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

  function isVideoDocument(doc: BackendArchivoItem): boolean {
    const mime = String(doc.mime_type || "").toLowerCase();
    const ext = String(doc.extension || "").toLowerCase();
    return mime.startsWith("video/") || VIDEO_EXTENSIONS.includes(ext);
  }

  function isImageDocument(doc: BackendArchivoItem): boolean {
    const mime = String(doc.mime_type || "").toLowerCase();
    const ext = String(doc.extension || "").toLowerCase();
    return mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
  }

  function applyDocumentToTarget(
    target: DocumentTarget,
    doc: BackendArchivoItem,
  ): void {
    // Se guarda la ruta canónica del backend (sin host ni prefijo de proxy) para
    // que el curso siga funcionando en localhost, Dev Tunnel o producción.
    const resolvedUrl = toApiPath(doc.storage_url);
    if (!resolvedUrl) {
      setActionError("El recurso seleccionado no tiene URL disponible.");
      return;
    }

    if (target.kind === "cover") {
      if (!isImageDocument(doc)) {
        setActionError("La portada debe ser un archivo de imagen.");
        return;
      }
      setPublishForm((current) => ({ ...current, portada_url: resolvedUrl }));
      return;
    }

    if (target.kind === "video") {
      if (!isVideoDocument(doc)) {
        setActionError("El video de la lección debe ser un archivo de video.");
        return;
      }
      updateLesson(target.moduleId, target.lessonId, (lesson) => ({
        ...lesson,
        video_url: resolvedUrl,
      }));
      return;
    }

    updateLesson(target.moduleId, target.lessonId, (lesson) => ({
      ...lesson,
      recursos: lesson.recursos.map((resource) => (
        resource.id === target.resourceId
          ? {
              ...resource,
              nombre: doc.nombre,
              url: resolvedUrl,
              tipo: resource.tipo || "archivo",
            }
          : resource
      )),
    }));
  }

  async function loadResourceFolder(parentId: string | null): Promise<void> {
    setResourceLoading(true);
    try {
      const explorer = await businessService.listDocumentExplorer(parentId);
      setResourceExplorer(explorer);
      setResourceCurrentFolderId(parentId);
    } catch {
      setActionError("No se pudieron cargar las carpetas de documentos.");
    } finally {
      setResourceLoading(false);
    }
  }

  async function handleSearchResource(): Promise<void> {
    if (!resourceSearch.trim()) {
      setResourceSearchResults(null);
      return;
    }

    setResourceSearching(true);
    try {
      const rows = await businessService.searchDocumentFiles(resourceSearch.trim());
      setResourceSearchResults(rows);
    } catch {
      setActionError("No se pudieron buscar recursos en tus carpetas.");
    } finally {
      setResourceSearching(false);
    }
  }

  async function openPickerForTarget(target: DocumentTarget): Promise<void> {
    setResourcePickerTarget(target);
    setResourcePickerOpen(true);
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail([{ id: null, name: "Raiz" }]);
    await loadResourceFolder(null);
  }

  function triggerUploadForTarget(target: DocumentTarget): void {
    setResourceUploadTarget(target);
    if (target.kind === "cover") {
      setResourceUploadAccept("image/*");
    } else if (target.kind === "video") {
      setResourceUploadAccept(VIDEO_UPLOAD_ACCEPT);
    } else {
      setResourceUploadAccept("*/*");
    }
    window.setTimeout(() => {
      resourceUploadInputRef.current?.click();
    }, 0);
  }

  async function openResourceFolder(folder: { id: string; nombre: string }): Promise<void> {
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail((prev) => [...prev, { id: folder.id, name: folder.nombre }]);
    await loadResourceFolder(folder.id);
  }

  async function jumpResourceTrail(index: number): Promise<void> {
    const node = resourceFolderTrail[index];
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail((prev) => prev.slice(0, index + 1));
    await loadResourceFolder(node.id);
  }

  function selectDocumentResource(doc: BackendArchivoItem): void {
    if (!resourcePickerTarget) {
      return;
    }

    applyDocumentToTarget(resourcePickerTarget, doc);
    setResourcePickerOpen(false);
    setResourcePickerTarget(null);
  }

  async function handleUploadResourceFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !resourceUploadTarget) {
      event.target.value = "";
      return;
    }

    if (resourceUploadTarget.kind === "cover" && !file.type.startsWith("image/")) {
      setActionError("La portada debe ser una imagen válida.");
      event.target.value = "";
      setResourceUploadTarget(null);
      return;
    }

    if (resourceUploadTarget.kind === "video") {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (!file.type.startsWith("video/") && !VIDEO_EXTENSIONS.includes(extension)) {
        setActionError("La lección requiere un archivo de video.");
        event.target.value = "";
        setResourceUploadTarget(null);
        return;
      }

      // Se avisa antes de subir: el backend rechaza el resto de contenedores y
      // el navegador tampoco sabría reproducirlos.
      if (!VIDEO_EXTENSIONS.includes(extension)) {
        setActionError(`Formato de video no soportado (.${extension}). Usa ${VIDEO_FORMATS_LABEL}.`);
        event.target.value = "";
        setResourceUploadTarget(null);
        return;
      }
    }

    try {
      // El tamaño se comprueba antes de transferir: un vídeo de clase tarda en
      // subir y esperar todo ese rato para recibir un rechazo del servidor —
      // que además llegaba disfrazado de error de CORS — no es aceptable.
      const limiteSubida = await obtenerLimiteSubida();
      if (file.size > limiteSubida) {
        setActionError(
          `El archivo pesa ${formatearTamano(file.size)} y el máximo es ${formatearTamano(limiteSubida)}. `
          + "Comprime el video o divídelo en varias lecciones.",
        );
        return;
      }

      const created = await businessService.uploadDocumentFile(file, resourceCurrentFolderId, "curso");
      applyDocumentToTarget(resourceUploadTarget, created);
      await loadResourceFolder(resourceCurrentFolderId);
    } catch (uploadError) {
      // El detalle del backend dice qué formato falló; el mensaje genérico
      // hacía parecer que el archivo sí se había cargado.
      const detail = uploadError instanceof Error ? uploadError.message.trim() : "";
      setActionError(detail || "No se pudo subir el archivo para este recurso.");
    } finally {
      setResourceUploadTarget(null);
      event.target.value = "";
    }
  }

  const totalCreatorStudents = creatorCourses.reduce((sum, course) => sum + course.estudiantes_count, 0);
  const totalCreatorRevenue = creatorCourses.reduce((sum, course) => sum + (course.precio * course.estudiantes_count), 0);
  const pickerAllFiles = resourceSearchResults ?? resourceExplorer.archivos;
  const pickerVisibleFiles = pickerAllFiles.filter((file) => {
    if (!resourcePickerTarget) {
      return true;
    }
    if (resourcePickerTarget.kind === "cover") {
      return isImageDocument(file);
    }
    if (resourcePickerTarget.kind === "video") {
      return isVideoDocument(file);
    }
    return true;
  });
  const pickerVisibleFolders = resourceSearchResults ? [] : resourceExplorer.carpetas;
  const pickerTitle = resourcePickerTarget?.kind === "cover"
    ? "Seleccionar portada desde Documentos"
    : resourcePickerTarget?.kind === "video"
      ? "Subir video local a Documentos"
      : "Seleccionar recurso desde Documentos";
  const pickerDescription = resourcePickerTarget?.kind === "cover"
    ? "Elige una imagen existente de tus carpetas para usarla como portada del curso."
    : resourcePickerTarget?.kind === "video"
      ? "Elige un archivo de video existente de tus carpetas para asociarlo a la lección."
      : "Elige un archivo existente de tus carpetas para asociarlo a la lección.";

  const renderCourseGrid = (rows: Course[]) => (
    <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {rows.map((course) => {
        const isPurchased = purchasedCourseIds.includes(course.id);
        const progress = progressByCourseId[course.id] || 0;

        return (
          <Card key={course.id} className="overflow-hidden gap-0">
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img
                src={safeHttpUrl(resolveApiUrl(course.portada_url), IMAGE_FALLBACK)}
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
                <Button variant="outline" onClick={() => { void handleOpenCourseDetail(course.id); }}>
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
          <Breadcrumb items={[{ label: "Inicio", onClick: onGoDashboard }, { label: "Cursos" }]} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cursos y capacitacion</h1>
            <p className="text-sm text-muted-foreground">
              {role === "solicitante"
                ? "Explora cursos, inscríbete y continúa clases con progreso sincronizado al backend."
                : "Publica cursos con módulos, videos y materiales descargables sobre la API real."}
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

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Cargando catálogo de cursos...
          </CardContent>
        </Card>
      ) : null}

      {error || actionError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error || actionError}</CardContent>
        </Card>
      ) : null}

      {role === "solicitante" ? (
        <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as "all" | "mine")} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-white p-1 shadow-sm sm:w-fit">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white">Todos los cursos</TabsTrigger>
            <TabsTrigger value="mine" className="data-[state=active]:bg-primary data-[state=active]:text-white">Mis cursos</TabsTrigger>
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
                <TabsTrigger value="recommended" className="data-[state=active]:bg-primary data-[state=active]:text-white"><Sparkles className="size-4" />Para ti</TabsTrigger>
                <TabsTrigger value="popular" className="data-[state=active]:bg-primary data-[state=active]:text-white"><Flame className="size-4" />Tendencias</TabsTrigger>
                <TabsTrigger value="categories" className="data-[state=active]:bg-primary data-[state=active]:text-white"><LibraryBig className="size-4" />Por categorias</TabsTrigger>
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
                  <p className="text-sm text-muted-foreground">Incluye cursos comprados por iniciar e iniciados, ordenados por actividad reciente.</p>
              </div>
              {inProgressCourses.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {inProgressCourses.map((course) => (
                    <Card key={course.id} className="gap-0 overflow-hidden">
                      <div className="aspect-[16/9] overflow-hidden bg-muted">
                        <img src={safeHttpUrl(resolveApiUrl(course.portada_url), IMAGE_FALLBACK)} alt={course.titulo} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }} />
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

            <Card className="gap-0 overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle className="text-lg font-semibold">Reproductor de cursos</CardTitle>
                <CardDescription>
                  El reproductor y el temario se abren en una vista dedicada cuando seleccionas Continuar o Ir a la clase.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Curso activo</p>
                    <p className="text-sm text-muted-foreground">{playerCourse?.titulo || "Aun no tienes curso activo"}</p>
                  </div>
                  <Button
                    onClick={() => {
                      if (playerCourse) {
                        handleOpenPlayer(playerCourse.id, activeLesson?.id || learningState.lastLessonIdByCourse[playerCourse.id]);
                      } else {
                        setMainTab("all");
                      }
                    }}
                  >
                    {playerCourse ? "Abrir reproductor" : "Explorar cursos"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-6">
                <CardDescription>Cursos publicados</CardDescription>
                <CardTitle className="text-3xl font-semibold">{creatorCourses.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-6">
                <CardDescription>Alumnos acumulados</CardDescription>
                <CardTitle className="text-3xl font-semibold">{totalCreatorStudents}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-6">
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
              <Button onClick={handleCreateCourse}>
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
                    <TableHead className="text-right">Acciones</TableHead>
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
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { void handleOpenCourseDetail(course.id); }}>
                            Ver
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEditCourse(course.id)}>
                            <Pencil className="size-3.5" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { void handleDeleteCourse(course.id); }}>
                            <Trash2 className="size-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
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

      <Dialog open={playerModalOpen} onOpenChange={setPlayerModalOpen}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reproductor / Mis cursos</DialogTitle>
            <DialogDescription>
              {playerCourse
                ? `Continua el curso ${playerCourse.titulo} y abre sus materiales descargables.`
                : "Compra un curso para habilitar el reproductor y el seguimiento de progreso."}
            </DialogDescription>
          </DialogHeader>

          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <Card className="gap-0 overflow-hidden">
              <CardContent className="space-y-4 pt-6">
                {playerCourse && activeLesson ? (
                  <>
                    <div className="overflow-hidden rounded-xl border bg-slate-950 shadow-sm">
                      <div className="aspect-video">
                        {(() => {
                          const playable = resolvePlayableVideoSource(activeLesson.video_url);
                          if (playable?.kind === "video") {
                            return (
                              <ProtectedVideoPlayer
                                url={playable.src}
                                onEnded={() => { void handleVideoFinished(activeLesson.id); }}
                              />
                            );
                          }

                          return (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Video no disponible o URL no segura
                          </div>
                          );
                        })()}
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
                        <p className="text-sm text-muted-foreground">Progreso sincronizado: {playerProgress}%</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSavingProgress}
                            onClick={() => { void handleVideoFinished(activeLesson.id); }}
                          >
                            Marcar clase como completada
                          </Button>
                          {/* El certificado solo aparece con el curso terminado:
                              es exactamente la condición que valida el backend. */}
                          {playerProgress >= 100 && playerCourse ? (
                            <Button
                              size="sm"
                              disabled={isDownloadingCertificate}
                              onClick={() => { void handleDownloadCertificate(playerCourse.id); }}
                            >
                              <Award className="mr-1.5 size-4" />
                              {isDownloadingCertificate ? "Generando..." : "Descargar certificado"}
                            </Button>
                          ) : null}
                        </div>
                        {certificateError ? <p className="text-sm text-destructive">{certificateError}</p> : null}
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
                <CardDescription>Temario y materiales descargables de la clase activa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6 overflow-y-auto">
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
                              onCheckedChange={(checked) => { void toggleLessonCompleted(playerCourse.id, lesson.id, checked === true); }}
                              className="mt-1"
                              disabled={isSavingProgress}
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
                            <Button
                              key={resource.id}
                              variant="outline"
                              className="w-full justify-between"
                              disabled={!isSafeHttpUrl(resolveApiUrl(resource.url))}
                              onClick={() => {
                                void openResourceInNewTab(resource.url).then((ok) => {
                                  if (!ok) setActionError("No se pudo abrir el recurso desde el backend.");
                                });
                              }}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <FileDown className="size-4" />
                                <span className="truncate">{resource.nombre}</span>
                              </span>
                              <Badge variant="secondary" className="capitalize">{resource.tipo}</Badge>
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
        </DialogContent>
      </Dialog>

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
                      {(() => {
                        const trailer = flattenLessons(selectedCourse)[0]?.video_url || "";
                        const playable = resolvePlayableVideoSource(trailer);
                        if (playable?.kind === "video") {
                          return <ProtectedVideoPlayer url={playable.src} />;
                        }
                        return (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Vista previa no disponible
                          </div>
                        );
                      })()}
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

                  {!isFetchingDetail && selectedCourse.modulos.length === 0 ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <p>No se pudo cargar la información del curso. Intenta nuevamente.</p>
                      <Button
                        variant="outline"
                        className="mt-3"
                        onClick={() => { void handleOpenCourseDetail(selectedCourse.id); }}
                      >
                        Reintentar
                      </Button>
                    </div>
                  ) : null}

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
                  <Button disabled={pendingPurchaseCourseId === selectedCourse.id} onClick={() => { void handlePurchase(selectedCourse.id); }}>
                    <Coins className="size-4" />
                    {pendingPurchaseCourseId === selectedCourse.id ? "Procesando..." : "Comprar curso"}
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
            <DialogTitle>{editingCourseId ? "Editar curso" : "Publicar nuevo curso"}</DialogTitle>
            <DialogDescription>
              {editingCourseId
                ? "Actualiza módulos, lecciones, videos subidos y recursos del curso." 
                : "Crea módulos, lecciones, videos subidos y recursos descargables para publicarlos en backend."}
            </DialogDescription>
          </DialogHeader>

          <input
            ref={resourceUploadInputRef}
            type="file"
            accept={resourceUploadAccept}
            className="hidden"
            onChange={(event) => { void handleUploadResourceFile(event); }}
          />

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
                  <p className="text-sm font-medium">Portada del curso</p>
                  <Input
                    value={publishForm.portada_url}
                    readOnly
                    placeholder="Selecciona o sube una imagen desde tus carpetas"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { void openPickerForTarget({ kind: "cover" }); }}>
                      Seleccionar imagen
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { triggerUploadForTarget({ kind: "cover" }); }}>
                      <Upload className="size-3.5" />
                      Subir imagen
                    </Button>
                    {publishForm.portada_url ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={resolveApiUrl(publishForm.portada_url)} target="_blank" rel="noreferrer">Ver</a>
                      </Button>
                    ) : null}
                  </div>
                  {publishForm.portada_url ? (
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <img
                        src={safeHttpUrl(resolveApiUrl(publishForm.portada_url), IMAGE_FALLBACK)}
                        alt="Portada seleccionada"
                        className="h-24 w-full rounded-md object-cover"
                        onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }}
                      />
                    </div>
                  ) : null}
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
                  <Card
                    key={module.id}
                    className={clsx("gap-4 border-dashed", draggingModuleId === module.id && "opacity-75")}
                    draggable
                    onDragStart={() => setDraggingModuleId(module.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingModuleId && draggingModuleId !== module.id) {
                        moveModuleTo(draggingModuleId, module.id);
                      }
                      setDraggingModuleId(null);
                    }}
                    onDragEnd={() => setDraggingModuleId(null)}
                  >
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
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => reorderModule(module.id, "up")} disabled={moduleIndex === 0}>
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => reorderModule(module.id, "down")} disabled={moduleIndex === publishForm.modulos.length - 1}>
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => removeModule(module.id)} disabled={publishForm.modulos.length === 1}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 pt-4">
                      {module.lecciones.map((lesson, lessonIndex) => (
                        <div
                          key={lesson.id}
                          className={clsx("space-y-3 rounded-xl border bg-muted/20 p-3", draggingLesson?.lessonId === lesson.id && "opacity-75")}
                          draggable
                          onDragStart={() => setDraggingLesson({ moduleId: module.id, lessonId: lesson.id })}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!draggingLesson || draggingLesson.moduleId !== module.id || draggingLesson.lessonId === lesson.id) {
                              return;
                            }
                            moveLessonTo(module.id, draggingLesson.lessonId, lesson.id);
                            setDraggingLesson(null);
                          }}
                          onDragEnd={() => setDraggingLesson(null)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">Lección {lessonIndex + 1}</p>
                            <div className="flex items-center gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => reorderLesson(module.id, lesson.id, "up")} disabled={lessonIndex === 0}>
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => reorderLesson(module.id, lesson.id, "down")} disabled={lessonIndex === module.lecciones.length - 1}>
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => removeLesson(module.id, lesson.id)} disabled={module.lecciones.length === 1}>
                                Eliminar lección
                              </Button>
                            </div>
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
                              <p className="text-xs font-medium">Video de la lección</p>
                              <Input
                                value={lesson.video_url}
                                readOnly
                                placeholder="Sube un video local a Documentos para vincularlo"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => { triggerUploadForTarget({ kind: "video", moduleId: module.id, lessonId: lesson.id }); }}>
                                  <Upload className="size-3.5" />
                                  Subir video local
                                </Button>
                                {lesson.video_url ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      void openResourceInNewTab(lesson.video_url).then((ok) => {
                                        if (!ok) setActionError("No se pudo abrir el video desde el backend.");
                                      });
                                    }}
                                  >
                                    Abrir video
                                  </Button>
                                ) : null}
                              </div>
                              {lesson.video_url ? (
                                <div className="rounded-lg border bg-black/90 p-2">
                                  <ProtectedVideoPlayer url={lesson.video_url} />
                                </div>
                              ) : null}
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
                                <div key={resource.id} className="space-y-2 rounded-lg border border-border/60 p-2">
                                  <div className="space-y-1">
                                    <Input
                                      value={resource.nombre}
                                      onChange={(event) => updateLesson(module.id, lesson.id, (current) => ({
                                        ...current,
                                        recursos: current.recursos.map((item) => item.id === resource.id ? { ...item, nombre: event.target.value } : item),
                                      }))}
                                      placeholder="Selecciona un recurso de tus carpetas"
                                    />
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {resource.url ? "Recurso vinculado desde Documentos" : "Debes seleccionar o subir desde tus carpetas"}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Select
                                      value={resource.tipo}
                                      onValueChange={(value) => updateLesson(module.id, lesson.id, (current) => ({
                                        ...current,
                                        recursos: current.recursos.map((item) => item.id === resource.id ? { ...item, tipo: value as ResourceType } : item),
                                      }))}
                                    >
                                      <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Tipo" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="archivo">Archivo</SelectItem>
                                        <SelectItem value="plantilla">Plantilla</SelectItem>
                                        <SelectItem value="checklist">Checklist</SelectItem>
                                        <SelectItem value="guia">Guía</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => { void openPickerForTarget({ kind: "resource", moduleId: module.id, lessonId: lesson.id, resourceId: resource.id }); }}>
                                      Seleccionar
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => { triggerUploadForTarget({ kind: "resource", moduleId: module.id, lessonId: lesson.id, resourceId: resource.id }); }}>
                                      <Upload className="size-3.5" />
                                      Subir
                                    </Button>
                                    {resource.url ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          void openResourceInNewTab(resource.url).then((ok) => {
                                            if (!ok) setActionError("No se pudo abrir el recurso desde el backend.");
                                          });
                                        }}
                                      >
                                        Abrir
                                      </Button>
                                    ) : null}
                                    <Button variant="outline" size="sm" onClick={() => removeResource(module.id, lesson.id, resource.id)} disabled={lesson.recursos.length === 1}>
                                      Quitar
                                    </Button>
                                  </div>
                                  {resource.url ? (
                                    <div className="rounded-md border bg-muted/20 p-2 text-[11px] text-muted-foreground">
                                      {/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(resource.url) ? (
                                        <img
                                          src={safeHttpUrl(resolveApiUrl(resource.url), IMAGE_FALLBACK)}
                                          alt={resource.nombre || "Recurso"}
                                          className="h-20 w-full rounded object-cover"
                                          onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }}
                                        />
                                      ) : (
                                        <p className="truncate">{resource.url}</p>
                                      )}
                                    </div>
                                  ) : null}
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
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowPublishModal(false); setEditingCourseId(null); }}>Cancelar</Button>
            <Button disabled={isPublishing} onClick={() => { void handlePublish(); }}>
              {isPublishing ? "Guardando..." : (editingCourseId ? "Guardar cambios" : "Publicar curso")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resourcePickerOpen} onOpenChange={setResourcePickerOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{pickerTitle}</DialogTitle>
            <DialogDescription>{pickerDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={resourceSearch}
                onChange={(event) => setResourceSearch(event.target.value)}
                placeholder="Buscar por nombre"
              />
              <Button variant="outline" onClick={() => { void handleSearchResource(); }} disabled={resourceSearching}>
                {resourceSearching ? "Buscando..." : "Buscar"}
              </Button>
              {resourceSearchResults ? (
                <Button variant="outline" onClick={() => { setResourceSearch(""); setResourceSearchResults(null); }}>
                  Limpiar
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {resourceFolderTrail.map((node, index) => (
                <button
                  key={`${node.id || "root"}-${index}`}
                  onClick={() => { void jumpResourceTrail(index); }}
                  className={clsx(
                    "rounded-md border px-2 py-1 text-xs",
                    index === resourceFolderTrail.length - 1
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-white text-muted-foreground hover:text-foreground",
                  )}
                >
                  {node.name}
                </button>
              ))}
            </div>

            <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {resourceLoading ? <p className="text-sm text-muted-foreground">Cargando carpetas...</p> : null}

              {!resourceLoading && pickerVisibleFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => { void openResourceFolder(folder); }}
                  className="rounded-xl border border-border bg-sky-50/40 p-4 text-left transition-colors hover:bg-sky-50"
                >
                  <p className="text-sm font-semibold">{folder.nombre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Carpeta</p>
                </button>
              ))}

              {!resourceLoading && pickerVisibleFiles.map((file) => (
                <div key={file.id} className="rounded-xl border border-border bg-white p-3">
                  <p className="truncate text-sm font-semibold">{file.nombre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{file.extension.toUpperCase()} · {new Date(file.created_at).toLocaleDateString("es-CO")}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void openResourceInNewTab(file.storage_url).then((ok) => {
                          if (!ok) setActionError("No se pudo abrir el recurso desde el backend.");
                        });
                      }}
                    >
                      Abrir
                    </Button>
                    <Button size="sm" onClick={() => selectDocumentResource(file)}>Usar recurso</Button>
                  </div>
                </div>
              ))}

              {!resourceLoading && pickerVisibleFolders.length === 0 && pickerVisibleFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No se encontraron recursos en esta vista.</p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFetchingDetail} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cargando detalle</DialogTitle>
            <DialogDescription>Consultando temario y recursos del curso seleccionado...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </main>
  );
}