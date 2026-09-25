/**
 * Catálogo simulado. Se reemplazará por tablas en Supabase; las carreras aquí
 * son una muestra representativa, no la oferta completa de cada institución.
 */

export type Career = { id: string; name: string };

export type University = {
  id: string;
  short: string;
  name: string;
  /** Nombre del examen de admisión, cuando no es el genérico. */
  exam?: string;
  careers: Career[];
};

export const UNIVERSITIES: University[] = [
  {
    id: "unam",
    short: "UNAM",
    name: "Universidad Nacional Autónoma de México",
    careers: [
      { id: "unam-medicina", name: "Médico Cirujano" },
      { id: "unam-derecho", name: "Derecho" },
      { id: "unam-psicologia", name: "Psicología" },
      { id: "unam-arquitectura", name: "Arquitectura" },
      { id: "unam-actuaria", name: "Actuaría" },
      { id: "unam-ing-computacion", name: "Ingeniería en Computación" },
      { id: "unam-contaduria", name: "Contaduría" },
    ],
  },
  {
    id: "ipn",
    short: "IPN",
    name: "Instituto Politécnico Nacional",
    careers: [
      { id: "ipn-sistemas", name: "Ingeniería en Sistemas Computacionales" },
      { id: "ipn-mecatronica", name: "Ingeniería Mecatrónica" },
      { id: "ipn-medico", name: "Médico Cirujano y Partero" },
      { id: "ipn-civil", name: "Ingeniería Civil" },
      { id: "ipn-negocios", name: "Negocios Internacionales" },
    ],
  },
  {
    id: "uam",
    short: "UAM",
    name: "Universidad Autónoma Metropolitana",
    careers: [
      { id: "uam-diseno", name: "Diseño de la Comunicación Gráfica" },
      { id: "uam-administracion", name: "Administración" },
      { id: "uam-nutricion", name: "Nutrición Humana" },
      { id: "uam-ing-biomedica", name: "Ingeniería Biomédica" },
    ],
  },
  {
    id: "uvm",
    short: "UVM",
    name: "Universidad del Valle de México",
    careers: [
      { id: "uvm-odontologia", name: "Odontología" },
      { id: "uvm-mercadotecnia", name: "Mercadotecnia" },
      { id: "uvm-gastronomia", name: "Gastronomía" },
    ],
  },
  {
    id: "tec",
    short: "TEC",
    name: "Tec de Monterrey",
    exam: "PAA",
    careers: [
      { id: "tec-itc", name: "Ingeniería en Tecnologías Computacionales" },
      { id: "tec-lae", name: "Administración y Estrategia" },
      { id: "tec-imt", name: "Ingeniería en Mecatrónica" },
      { id: "tec-lri", name: "Relaciones Internacionales" },
    ],
  },
  {
    id: "udg",
    short: "UDG",
    name: "Universidad de Guadalajara",
    careers: [
      { id: "udg-medicina", name: "Medicina" },
      { id: "udg-enfermeria", name: "Enfermería" },
      { id: "udg-abogado", name: "Abogado" },
      { id: "udg-informatica", name: "Ingeniería Informática" },
    ],
  },
];

export function findUniversity(id: string | null) {
  return UNIVERSITIES.find((u) => u.id === id) ?? null;
}

export function findCareer(universityId: string | null, careerId: string | null) {
  return findUniversity(universityId)?.careers.find((c) => c.id === careerId) ?? null;
}
