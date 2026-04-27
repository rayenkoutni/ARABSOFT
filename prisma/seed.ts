import { execFileSync } from "child_process"
import bcrypt from "bcryptjs"

type Role = "COLLABORATEUR" | "CHEF" | "RH"
type SkillType = "SOFT" | "TECHNICAL"
type EmployeeSkillHistoryAction = "ADD" | "LEVEL_UPDATE" | "REMOVE"
type RequestType = "CONGE" | "AUTORISATION" | "PRET" | "DOCUMENT"
type TaskPriority = "LOW" | "MEDIUM" | "HIGH"
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
type ProjectStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINE"

const roster = {
  rh: {
    email: "rh@demo.com",
    name: "Marie Dupont",
    role: "RH" as Role,
    department: "RH",
    position: "Responsable RH",
    phone: "+216 20 110 501",
  },
  chefs: [
    {
      email: "chef@demo.com",
      name: "Sophie Bernard",
      role: "CHEF" as Role,
      department: "Engineering",
      position: "Chef de projet technique",
      phone: "+216 21 210 601",
    },
    {
      email: "chef2@demo.com",
      name: "Karim Mansouri",
      role: "CHEF" as Role,
      department: "Design",
      position: "Chef d'equipe design",
      phone: "+216 22 310 602",
    },
    {
      email: "chef3@demo.com",
      name: "Yassine Ben Salem",
      role: "CHEF" as Role,
      department: "Product",
      position: "Chef d'equipe produit",
      phone: "+216 23 410 603",
    },
    {
      email: "chef4@demo.com",
      name: "Ines Gharbi",
      role: "CHEF" as Role,
      department: "Operations",
      position: "Chef d'equipe operations",
      phone: "+216 24 510 604",
    },
  ],
  collaborators: [
    {
      email: "collab1@demo.com",
      name: "Thomas Martin",
      role: "COLLABORATEUR" as Role,
      department: "Engineering",
      position: "Developpeur Back-End",
      phone: "+216 50 610 701",
      managerEmail: "chef@demo.com",
    },
    {
      email: "collab2@demo.com",
      name: "Leila Hamdi",
      role: "COLLABORATEUR" as Role,
      department: "Engineering",
      position: "Developpeuse Front-End",
      phone: "+216 51 620 702",
      managerEmail: "chef@demo.com",
    },
    {
      email: "collab3@demo.com",
      name: "Amine Trabelsi",
      role: "COLLABORATEUR" as Role,
      department: "Design",
      position: "Designer UI/UX",
      phone: "+216 52 630 703",
      managerEmail: "chef2@demo.com",
    },
    {
      email: "collab4@demo.com",
      name: "Nour Ben Youssef",
      role: "COLLABORATEUR" as Role,
      department: "Engineering",
      position: "Ingenieure QA",
      phone: "+216 53 640 704",
      managerEmail: "chef@demo.com",
    },
    {
      email: "collab5@demo.com",
      name: "Hedi Chaabane",
      role: "COLLABORATEUR" as Role,
      department: "Engineering",
      position: "Developpeur Full-Stack",
      phone: "+216 54 650 705",
      managerEmail: "chef@demo.com",
    },
    {
      email: "collab6@demo.com",
      name: "Salma Kallel",
      role: "COLLABORATEUR" as Role,
      department: "Design",
      position: "Graphiste",
      phone: "+216 55 660 706",
      managerEmail: "chef2@demo.com",
    },
    {
      email: "collab7@demo.com",
      name: "Farah Jebali",
      role: "COLLABORATEUR" as Role,
      department: "Design",
      position: "Product Designer",
      phone: "+216 56 670 707",
      managerEmail: "chef2@demo.com",
    },
    {
      email: "collab8@demo.com",
      name: "Walid Jaziri",
      role: "COLLABORATEUR" as Role,
      department: "Product",
      position: "Business Analyst",
      phone: "+216 58 680 708",
      managerEmail: "chef3@demo.com",
    },
    {
      email: "collab9@demo.com",
      name: "Rania Mezni",
      role: "COLLABORATEUR" as Role,
      department: "Product",
      position: "Data Analyst",
      phone: "+216 90 690 709",
      managerEmail: "chef3@demo.com",
    },
    {
      email: "collab10@demo.com",
      name: "Omar Chatti",
      role: "COLLABORATEUR" as Role,
      department: "Operations",
      position: "Support IT",
      phone: "+216 91 700 710",
      managerEmail: "chef4@demo.com",
    },
  ],
} as const

const skillCatalog = [
  ["Communication", "SOFT", "Capacite a communiquer clairement avec l'equipe et les parties prenantes."],
  ["Travail d'equipe", "SOFT", "Capacite a collaborer efficacement au sein d'une equipe."],
  ["Discipline", "SOFT", "Capacite a respecter les engagements, les delais et les procedures."],
  ["Resolution de problemes", "SOFT", "Capacite a analyser une situation et proposer des solutions adaptees."],
  ["React", "TECHNICAL", "Developpement d'interfaces web avec React."],
  ["Next.js", "TECHNICAL", "Developpement d'applications web avec Next.js."],
  ["TypeScript", "TECHNICAL", "Developpement type en TypeScript pour le frontend et le backend."],
  ["Node.js", "TECHNICAL", "Developpement backend et services en Node.js."],
  ["PostgreSQL", "TECHNICAL", "Conception et exploitation de bases de donnees PostgreSQL."],
  ["Prisma", "TECHNICAL", "Modele de donnees et acces aux donnees avec Prisma."],
  ["Git", "TECHNICAL", "Gestion de versions et collaboration avec Git."],
  ["Docker", "TECHNICAL", "Conteneurisation d'applications et d'environnements techniques."],
  ["Figma", "TECHNICAL", "Conception de maquettes et prototypage sous Figma."],
  ["Adobe XD", "TECHNICAL", "Conception d'interfaces et wireframes sous Adobe XD."],
  ["SQL", "TECHNICAL", "Manipulation et analyse de donnees en SQL."],
  ["Power BI", "TECHNICAL", "Creation de tableaux de bord et analyses avec Power BI."],
  ["Excel avance", "TECHNICAL", "Analyses avancees, tableaux croises et automatisation sous Excel."],
  ["Cypress", "TECHNICAL", "Automatisation de tests end-to-end avec Cypress."],
] as const satisfies readonly [string, SkillType, string][]

const employmentData: Record<string, { hireDate: string; leaveBalance: number }> = {
  "rh@demo.com": { hireDate: "2023-01-09T08:00:00.000Z", leaveBalance: 13.75 },
  "chef@demo.com": { hireDate: "2023-03-06T08:00:00.000Z", leaveBalance: 12.75 },
  "chef2@demo.com": { hireDate: "2023-05-15T08:00:00.000Z", leaveBalance: 10 },
  "chef3@demo.com": { hireDate: "2023-09-04T08:00:00.000Z", leaveBalance: 8.25 },
  "chef4@demo.com": { hireDate: "2024-01-08T08:00:00.000Z", leaveBalance: 11.5 },
  "collab1@demo.com": { hireDate: "2024-02-05T08:00:00.000Z", leaveBalance: 5.5 },
  "collab2@demo.com": { hireDate: "2024-03-11T08:00:00.000Z", leaveBalance: 8.25 },
  "collab3@demo.com": { hireDate: "2024-04-15T08:00:00.000Z", leaveBalance: 10 },
  "collab4@demo.com": { hireDate: "2024-05-06T08:00:00.000Z", leaveBalance: 12.75 },
  "collab5@demo.com": { hireDate: "2024-06-10T08:00:00.000Z", leaveBalance: 13.75 },
  "collab6@demo.com": { hireDate: "2024-07-01T08:00:00.000Z", leaveBalance: 7.25 },
  "collab7@demo.com": { hireDate: "2024-08-12T08:00:00.000Z", leaveBalance: 11 },
  "collab8@demo.com": { hireDate: "2024-09-02T08:00:00.000Z", leaveBalance: 6.5 },
  "collab9@demo.com": { hireDate: "2024-10-07T08:00:00.000Z", leaveBalance: 9.75 },
  "collab10@demo.com": { hireDate: "2024-11-04T08:00:00.000Z", leaveBalance: 4.75 },
}

const onboardingDates: Record<string, string> = {
  "collab1@demo.com": "2026-03-17T08:45:00.000Z",
  "collab2@demo.com": "2026-03-17T09:10:00.000Z",
  "collab3@demo.com": "2026-03-17T09:35:00.000Z",
  "collab4@demo.com": "2026-03-18T08:30:00.000Z",
  "collab5@demo.com": "2026-03-18T09:05:00.000Z",
  "collab6@demo.com": "2026-03-18T09:40:00.000Z",
  "collab7@demo.com": "2026-03-19T08:50:00.000Z",
  "collab8@demo.com": "2026-03-19T09:20:00.000Z",
  "collab9@demo.com": "2026-03-19T09:55:00.000Z",
  "collab10@demo.com": "2026-03-20T08:40:00.000Z",
}

const collaboratorProfiles: Record<
  string,
  {
    soft: Record<string, number>
    technical: Record<string, number>
  }
> = {
  "collab1@demo.com": {
    soft: {
      Communication: 4,
      "Travail d'equipe": 4,
      Discipline: 3,
      "Resolution de problemes": 4,
    },
    technical: {
      "Node.js": 4,
      PostgreSQL: 3,
      Prisma: 3,
      Git: 4,
    },
  },
  "collab2@demo.com": {
    soft: {
      Communication: 3,
      "Travail d'equipe": 4,
      Discipline: 4,
      "Resolution de problemes": 3,
    },
    technical: {
      React: 4,
      "Next.js": 3,
      TypeScript: 3,
      Git: 4,
    },
  },
  "collab3@demo.com": {
    soft: {
      Communication: 4,
      "Travail d'equipe": 4,
      Discipline: 3,
      "Resolution de problemes": 3,
    },
    technical: {
      Figma: 4,
      "Adobe XD": 4,
      React: 2,
    },
  },
  "collab4@demo.com": {
    soft: {
      Communication: 3,
      "Travail d'equipe": 4,
      Discipline: 4,
      "Resolution de problemes": 3,
    },
    technical: {
      Cypress: 4,
      SQL: 3,
      Git: 3,
    },
  },
  "collab5@demo.com": {
    soft: {
      Communication: 3,
      "Travail d'equipe": 4,
      Discipline: 3,
      "Resolution de problemes": 4,
    },
    technical: {
      React: 3,
      "Next.js": 4,
      TypeScript: 4,
      Git: 4,
      Docker: 3,
    },
  },
  "collab6@demo.com": {
    soft: {
      Communication: 3,
      "Travail d'equipe": 4,
      Discipline: 3,
      "Resolution de problemes": 3,
    },
    technical: {
      Figma: 3,
      "Adobe XD": 3,
    },
  },
  "collab7@demo.com": {
    soft: {
      Communication: 4,
      "Travail d'equipe": 4,
      Discipline: 3,
      "Resolution de problemes": 3,
    },
    technical: {
      Figma: 4,
      "Adobe XD": 4,
    },
  },
  "collab8@demo.com": {
    soft: {
      Communication: 3,
      "Travail d'equipe": 4,
      Discipline: 3,
      "Resolution de problemes": 3,
    },
    technical: {
      "Power BI": 4,
      "Excel avance": 5,
      SQL: 4,
    },
  },
  "collab9@demo.com": {
    soft: {
      Communication: 3,
      "Travail d'equipe": 3,
      Discipline: 3,
      "Resolution de problemes": 4,
    },
    technical: {
      "Power BI": 3,
      "Excel avance": 4,
      SQL: 3,
      PostgreSQL: 2,
    },
  },
  "collab10@demo.com": {
    soft: {
      Communication: 4,
      "Travail d'equipe": 3,
      Discipline: 3,
      "Resolution de problemes": 3,
    },
    technical: {
      Docker: 2,
      SQL: 2,
      Git: 3,
    },
  },
}

const historyEntries = [
  ["collab1@demo.com", "PostgreSQL", "LEVEL_UPDATE", 2, 3, "chef@demo.com", "2026-03-24T09:15:00.000Z"],
  ["collab1@demo.com", "Prisma", "ADD", null, 3, "chef@demo.com", "2026-03-31T14:20:00.000Z"],
  ["collab1@demo.com", "Communication", "LEVEL_UPDATE", 3, 4, "chef@demo.com", "2026-04-08T10:05:00.000Z"],
  ["collab2@demo.com", "Next.js", "LEVEL_UPDATE", 2, 3, "chef@demo.com", "2026-03-25T11:10:00.000Z"],
  ["collab2@demo.com", "TypeScript", "LEVEL_UPDATE", 2, 3, "chef@demo.com", "2026-04-01T09:45:00.000Z"],
  ["collab2@demo.com", "Discipline", "LEVEL_UPDATE", 3, 4, "chef@demo.com", "2026-04-09T15:00:00.000Z"],
  ["collab3@demo.com", "Adobe XD", "LEVEL_UPDATE", 3, 4, "chef2@demo.com", "2026-03-26T10:20:00.000Z"],
  ["collab3@demo.com", "React", "ADD", null, 2, "chef2@demo.com", "2026-04-02T13:30:00.000Z"],
  ["collab3@demo.com", "Communication", "LEVEL_UPDATE", 3, 4, "chef2@demo.com", "2026-04-10T11:25:00.000Z"],
  ["collab4@demo.com", "Cypress", "LEVEL_UPDATE", 3, 4, "chef@demo.com", "2026-03-27T08:55:00.000Z"],
  ["collab4@demo.com", "SQL", "ADD", null, 3, "chef@demo.com", "2026-04-03T16:05:00.000Z"],
  ["collab4@demo.com", "Discipline", "LEVEL_UPDATE", 3, 4, "chef@demo.com", "2026-04-11T09:40:00.000Z"],
  ["collab5@demo.com", "React", "LEVEL_UPDATE", 2, 3, "chef@demo.com", "2026-03-28T10:35:00.000Z"],
  ["collab5@demo.com", "Next.js", "LEVEL_UPDATE", 3, 4, "chef@demo.com", "2026-04-04T14:10:00.000Z"],
  ["collab5@demo.com", "Git", "LEVEL_UPDATE", 3, 4, "chef@demo.com", "2026-04-12T10:50:00.000Z"],
  ["collab6@demo.com", "Figma", "LEVEL_UPDATE", 2, 3, "chef2@demo.com", "2026-03-29T09:05:00.000Z"],
  ["collab6@demo.com", "Adobe XD", "LEVEL_UPDATE", 2, 3, "chef2@demo.com", "2026-04-05T11:35:00.000Z"],
  ["collab6@demo.com", "React", "REMOVE", 2, null, "chef2@demo.com", "2026-04-13T15:15:00.000Z"],
  ["collab7@demo.com", "Figma", "LEVEL_UPDATE", 3, 4, "chef2@demo.com", "2026-03-30T10:10:00.000Z"],
  ["collab7@demo.com", "Adobe XD", "LEVEL_UPDATE", 3, 4, "chef2@demo.com", "2026-04-06T13:05:00.000Z"],
  ["collab7@demo.com", "Communication", "LEVEL_UPDATE", 3, 4, "chef2@demo.com", "2026-04-14T09:20:00.000Z"],
  ["collab8@demo.com", "Power BI", "LEVEL_UPDATE", 3, 4, "chef3@demo.com", "2026-03-31T08:40:00.000Z"],
  ["collab8@demo.com", "Excel avance", "LEVEL_UPDATE", 4, 5, "chef3@demo.com", "2026-04-07T15:30:00.000Z"],
  ["collab8@demo.com", "SQL", "LEVEL_UPDATE", 3, 4, "chef3@demo.com", "2026-04-15T10:25:00.000Z"],
  ["collab9@demo.com", "Power BI", "LEVEL_UPDATE", 2, 3, "chef3@demo.com", "2026-04-01T10:55:00.000Z"],
  ["collab9@demo.com", "PostgreSQL", "ADD", null, 2, "chef3@demo.com", "2026-04-08T14:15:00.000Z"],
  ["collab9@demo.com", "Resolution de problemes", "LEVEL_UPDATE", 3, 4, "chef3@demo.com", "2026-04-16T09:35:00.000Z"],
  ["collab10@demo.com", "Docker", "ADD", null, 2, "chef4@demo.com", "2026-04-02T09:25:00.000Z"],
  ["collab10@demo.com", "SQL", "LEVEL_UPDATE", 1, 2, "chef4@demo.com", "2026-04-09T11:00:00.000Z"],
  ["collab10@demo.com", "Communication", "LEVEL_UPDATE", 3, 4, "chef4@demo.com", "2026-04-17T08:45:00.000Z"],
] as const satisfies readonly [string, string, EmployeeSkillHistoryAction, number | null, number | null, string, string][]

const slaDefaults: ReadonlyArray<{
  requestType: RequestType
  maxHours: number
  description: string
}> = [
  { requestType: "CONGE", maxHours: 48, description: "Conge - 48h" },
  { requestType: "AUTORISATION", maxHours: 24, description: "Autorisation - 24h" },
  { requestType: "PRET", maxHours: 72, description: "Pret - 72h" },
  { requestType: "DOCUMENT", maxHours: 48, description: "Document - 48h" },
]

const demoProjects = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    name: "Portail RH - Sprint Avril",
    description: "Ameliorations du module demandes et stabilisation generale.",
    managerEmail: "chef@demo.com",
    createdByEmail: "chef@demo.com",
    createdByRole: "CHEF" as Role,
    status: "EN_COURS" as ProjectStatus,
    priority: "HIGH",
    startDate: "2026-04-01T08:00:00.000Z",
    endDate: "2026-05-15T18:00:00.000Z",
    createdAt: "2026-04-01T08:00:00.000Z",
    updatedAt: "2026-04-21T12:04:31.039Z",
    progress: 25,
    teamEmails: ["collab1@demo.com", "collab4@demo.com", "collab2@demo.com", "collab5@demo.com"],
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    name: "Refonte Design System",
    description: "Refonte des composants visuels et harmonisation de l'identite produit.",
    managerEmail: "chef2@demo.com",
    createdByEmail: "rh@demo.com",
    createdByRole: "RH" as Role,
    status: "EN_COURS" as ProjectStatus,
    priority: "MEDIUM",
    startDate: "2026-03-25T08:30:00.000Z",
    endDate: "2026-05-05T18:00:00.000Z",
    createdAt: "2026-03-25T08:30:00.000Z",
    updatedAt: "2026-04-17T16:30:00.000Z",
    progress: 35,
    teamEmails: ["collab3@demo.com", "collab6@demo.com", "collab7@demo.com"],
  },
] as const

const demoTasks = [
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    assigneeEmail: "collab1@demo.com",
    title: "API demandes de conge",
    description: "Finaliser les endpoints de creation et lecture des demandes de conge.",
    status: "DONE" as TaskStatus,
    priority: "HIGH" as TaskPriority,
    dueDate: "2026-04-10T18:00:00.000Z",
    submittedForReview: false,
    reviewComment: "Valide apres revue",
    reviewedByEmail: "chef@demo.com",
    reviewedAt: "2026-04-11T10:00:00.000Z",
    createdAt: "2026-04-03T09:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
    requiredSkills: [
      ["Node.js", 4],
      ["Prisma", 3],
      ["PostgreSQL", 3],
    ] as const,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    assigneeEmail: "collab2@demo.com",
    title: "UI approbations RH",
    description: "Mettre a jour les cartes et le filtrage des approbations RH.",
    status: "IN_REVIEW" as TaskStatus,
    priority: "HIGH" as TaskPriority,
    dueDate: "2026-04-19T18:00:00.000Z",
    submittedForReview: true,
    reviewComment: null,
    reviewedByEmail: "chef@demo.com",
    reviewedAt: "2026-04-21T12:00:02.320Z",
    createdAt: "2026-04-08T09:30:00.000Z",
    updatedAt: "2026-04-21T12:02:44.769Z",
    requiredSkills: [
      ["React", 4],
      ["Next.js", 3],
      ["TypeScript", 3],
    ] as const,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    assigneeEmail: "collab4@demo.com",
    title: "Tests workflow demandes",
    description: "Preparer les scenarios de test des demandes et validations.",
    status: "IN_REVIEW" as TaskStatus,
    priority: "MEDIUM" as TaskPriority,
    dueDate: "2026-04-22T18:00:00.000Z",
    submittedForReview: true,
    reviewComment: null,
    reviewedByEmail: null,
    reviewedAt: null,
    createdAt: "2026-04-14T11:00:00.000Z",
    updatedAt: "2026-04-21T12:04:31.030Z",
    requiredSkills: [
      ["Cypress", 4],
      ["SQL", 3],
    ] as const,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    assigneeEmail: "collab5@demo.com",
    title: "Refactor services projet",
    description: "Nettoyer les helpers et reduire les doublons dans le module projet.",
    status: "IN_PROGRESS" as TaskStatus,
    priority: "MEDIUM" as TaskPriority,
    dueDate: "2026-04-24T18:00:00.000Z",
    submittedForReview: false,
    reviewComment: null,
    reviewedByEmail: null,
    reviewedAt: null,
    createdAt: "2026-04-15T08:45:00.000Z",
    updatedAt: "2026-04-18T09:40:00.000Z",
    requiredSkills: [
      ["TypeScript", 4],
      ["Git", 4],
      ["Docker", 3],
    ] as const,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    assigneeEmail: "collab3@demo.com",
    title: "Audit composants design",
    description: "Analyser les composants existants et identifier les ecarts visuels.",
    status: "DONE" as TaskStatus,
    priority: "MEDIUM" as TaskPriority,
    dueDate: "2026-04-09T18:00:00.000Z",
    submittedForReview: false,
    reviewComment: "Livrable conforme",
    reviewedByEmail: "chef2@demo.com",
    reviewedAt: "2026-04-10T12:15:00.000Z",
    createdAt: "2026-03-29T10:00:00.000Z",
    updatedAt: "2026-04-10T12:15:00.000Z",
    requiredSkills: [
      ["Figma", 4],
      ["Adobe XD", 4],
    ] as const,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    assigneeEmail: "collab6@demo.com",
    title: "Bibliotheque de styles",
    description: "Creer les styles partages et les regles de typographie.",
    status: "IN_PROGRESS" as TaskStatus,
    priority: "HIGH" as TaskPriority,
    dueDate: "2026-04-23T18:00:00.000Z",
    submittedForReview: false,
    reviewComment: null,
    reviewedByEmail: null,
    reviewedAt: null,
    createdAt: "2026-04-07T09:15:00.000Z",
    updatedAt: "2026-04-18T10:10:00.000Z",
    requiredSkills: [
      ["Figma", 3],
      ["Adobe XD", 3],
    ] as const,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007",
    projectId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    assigneeEmail: "collab7@demo.com",
    title: "Maquettes tableaux de bord",
    description: "Preparer les maquettes UI des tableaux de bord produit.",
    status: "TODO" as TaskStatus,
    priority: "MEDIUM" as TaskPriority,
    dueDate: "2026-04-25T18:00:00.000Z",
    submittedForReview: false,
    reviewComment: null,
    reviewedByEmail: null,
    reviewedAt: null,
    createdAt: "2026-04-16T09:20:00.000Z",
    updatedAt: "2026-04-16T09:20:00.000Z",
    requiredSkills: [
      ["Figma", 4],
      ["Adobe XD", 4],
    ] as const,
  },
] as const

function sqlString(value: string | null) {
  if (value == null) {
    return "NULL"
  }

  return `'${value.replace(/'/g, "''")}'`
}

function sqlTimestamp(value: string | null) {
  return value == null ? "NULL" : `${sqlString(value)}::timestamptz`
}

function employeeIdSubquery(email: string) {
  return `(SELECT id FROM "Employee" WHERE email = ${sqlString(email)})`
}

function skillIdSubquery(name: string) {
  return `(SELECT id FROM "Skill" WHERE name = ${sqlString(name)})`
}

function skillTypeSubquery(name: string) {
  return `(SELECT type FROM "Skill" WHERE name = ${sqlString(name)})`
}

function buildSql(hashedPassword: string) {
  const statements: string[] = []

  statements.push("BEGIN;")

  for (const employee of [roster.rh, ...roster.chefs]) {
    const employment = employmentData[employee.email]
    statements.push(`
INSERT INTO "Employee" ("id", "name", "email", "password", "phone", "role", "department", "position", "managerId", "hireDate", "leaveBalance", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), ${sqlString(employee.name)}, ${sqlString(employee.email)}, ${sqlString(hashedPassword)}, ${sqlString(employee.phone)}, ${sqlString(employee.role)}, ${sqlString(employee.department)}, ${sqlString(employee.position)}, NULL, ${sqlTimestamp(employment.hireDate)}, ${employment.leaveBalance}, NOW(), NOW())
ON CONFLICT ("email") DO NOTHING;`)
  }

  for (const employee of roster.collaborators) {
    const employment = employmentData[employee.email]
    statements.push(`
INSERT INTO "Employee" ("id", "name", "email", "password", "phone", "role", "department", "position", "managerId", "hireDate", "leaveBalance", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  ${sqlString(employee.name)},
  ${sqlString(employee.email)},
  ${sqlString(hashedPassword)},
  ${sqlString(employee.phone)},
  ${sqlString(employee.role)},
  ${sqlString(employee.department)},
  ${sqlString(employee.position)},
  ${employeeIdSubquery(employee.managerEmail)},
  ${sqlTimestamp(employment.hireDate)},
  ${employment.leaveBalance},
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;`)
  }

  for (const [name, type, description] of skillCatalog) {
    statements.push(`
INSERT INTO "Skill" ("id", "name", "type", "isMandatory", "isActive", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), ${sqlString(name)}, ${sqlString(type)}, ${type === "SOFT" ? "TRUE" : "FALSE"}, TRUE, ${sqlString(description)}, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;`)
  }

  for (const [employeeEmail, profile] of Object.entries(collaboratorProfiles)) {
    const buildSkillInsert = (skillName: string, level: number) => {
      const historyForSkill = historyEntries.filter(
        (entry) => entry[0] === employeeEmail && entry[1] === skillName
      )
      const onboardingDate = onboardingDates[employeeEmail]
      const addEntry = historyForSkill.find((entry) => entry[2] === "ADD")
      const createdAt = addEntry?.[6] ?? onboardingDate
      const updatedAt = historyForSkill.length > 0
        ? historyForSkill
            .map((entry) => entry[6])
            .sort()
            .at(-1) ?? createdAt
        : createdAt

      return `
INSERT INTO "EmployeeSkill" ("id", "employeeId", "skillId", "level", "acquiredAt", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  ${employeeIdSubquery(employeeEmail)},
  ${skillIdSubquery(skillName)},
  ${level},
  ${sqlTimestamp(createdAt)},
  ${sqlTimestamp(createdAt)},
  ${sqlTimestamp(updatedAt)}
)
ON CONFLICT ("employeeId", "skillId") DO NOTHING;`
    }

    for (const [skillName, level] of Object.entries(profile.soft)) {
      statements.push(buildSkillInsert(skillName, level))
    }

    for (const [skillName, level] of Object.entries(profile.technical)) {
      statements.push(buildSkillInsert(skillName, level))
    }
  }

  for (const [employeeEmail, skillName, action, oldLevel, newLevel, actorEmail, createdAt] of historyEntries) {
    statements.push(`
INSERT INTO "EmployeeSkillHistory" ("id", "employeeId", "skillId", "skillName", "skillType", "action", "oldLevel", "newLevel", "comment", "actorId", "createdAt")
SELECT
  gen_random_uuid(),
  ${employeeIdSubquery(employeeEmail)},
  ${skillIdSubquery(skillName)},
  ${sqlString(skillName)},
  ${skillTypeSubquery(skillName)},
  ${sqlString(action)},
  ${oldLevel == null ? "NULL" : oldLevel},
  ${newLevel == null ? "NULL" : newLevel},
  NULL,
  ${employeeIdSubquery(actorEmail)},
  ${sqlTimestamp(createdAt)}
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmployeeSkillHistory"
  WHERE "employeeId" = ${employeeIdSubquery(employeeEmail)}
    AND "skillId" = ${skillIdSubquery(skillName)}
    AND "action" = ${sqlString(action)}::"EmployeeSkillHistoryAction"
    AND "oldLevel" IS NOT DISTINCT FROM ${oldLevel == null ? "NULL" : oldLevel}
    AND "newLevel" IS NOT DISTINCT FROM ${newLevel == null ? "NULL" : newLevel}
    AND "comment" IS NULL
    AND "actorId" = ${employeeIdSubquery(actorEmail)}
    AND "createdAt" = ${sqlTimestamp(createdAt)}
);`)
  }

  for (const config of slaDefaults) {
    statements.push(`
INSERT INTO "SlaConfig" ("id", "requestType", "maxHours", "description", "createdAt")
VALUES (gen_random_uuid(), ${sqlString(config.requestType)}, ${config.maxHours}, ${sqlString(config.description)}, NOW())
ON CONFLICT ("requestType") DO NOTHING;`)
  }

  for (const project of demoProjects) {
    statements.push(`
INSERT INTO "Project" ("id", "name", "description", "progress", "managerId", "createdById", "createdByRole", "status", "priority", "startDate", "endDate", "createdAt", "updatedAt")
VALUES (
  ${sqlString(project.id)},
  ${sqlString(project.name)},
  ${sqlString(project.description)},
  ${project.progress},
  ${employeeIdSubquery(project.managerEmail)},
  ${employeeIdSubquery(project.createdByEmail)},
  ${sqlString(project.createdByRole)},
  ${sqlString(project.status)},
  ${sqlString(project.priority)},
  ${sqlTimestamp(project.startDate)},
  ${sqlTimestamp(project.endDate)},
  ${sqlTimestamp(project.createdAt)},
  ${sqlTimestamp(project.updatedAt)}
)
ON CONFLICT ("id") DO NOTHING;`)

    for (const teamEmail of project.teamEmails) {
      statements.push(`
INSERT INTO "_ProjectTeam" ("A", "B")
VALUES (${employeeIdSubquery(teamEmail)}, ${sqlString(project.id)})
ON CONFLICT ("A", "B") DO NOTHING;`)
    }
  }

  for (const task of demoTasks) {
    statements.push(`
INSERT INTO "Task" ("id", "title", "description", "status", "priority", "assigneeId", "projectId", "dueDate", "submittedForReview", "reviewComment", "reviewedById", "reviewedAt", "createdAt", "updatedAt")
VALUES (
  ${sqlString(task.id)},
  ${sqlString(task.title)},
  ${sqlString(task.description)},
  ${sqlString(task.status)},
  ${sqlString(task.priority)},
  ${employeeIdSubquery(task.assigneeEmail)},
  ${sqlString(task.projectId)},
  ${sqlTimestamp(task.dueDate)},
  ${task.submittedForReview ? "TRUE" : "FALSE"},
  ${sqlString(task.reviewComment)},
  ${task.reviewedByEmail ? employeeIdSubquery(task.reviewedByEmail) : "NULL"},
  ${sqlTimestamp(task.reviewedAt)},
  ${sqlTimestamp(task.createdAt)},
  ${sqlTimestamp(task.updatedAt)}
)
ON CONFLICT ("id") DO NOTHING;`)

    for (const [skillName, minimumLevel] of task.requiredSkills) {
      statements.push(`
INSERT INTO "TaskRequiredSkill" ("id", "taskId", "skillId", "minimumLevel", "createdAt")
VALUES (
  gen_random_uuid(),
  ${sqlString(task.id)},
  ${skillIdSubquery(skillName)},
  ${minimumLevel},
  ${sqlTimestamp(task.createdAt)}
)
ON CONFLICT ("taskId", "skillId") DO NOTHING;`)
    }
  }

  statements.push("COMMIT;")

  return statements.join("\n")
}

function resolveDbContainer() {
  const explicitContainer = process.env.POSTGRES_CONTAINER?.trim()
  if (explicitContainer) {
    return explicitContainer
  }

  const composeContainerId = execFileSync(
    "docker",
    ["compose", "ps", "-q", "db"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }
  ).trim()

  if (!composeContainerId) {
    throw new Error(
      "Could not find a running Docker Compose container for the db service. Start it with `docker compose up -d db` and try again."
    )
  }

  return composeContainerId
}

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10)
  const sql = buildSql(hashedPassword)
  const dbContainer = resolveDbContainer()

  execFileSync(
    "docker",
    ["exec", "-i", dbContainer, "psql", "-U", "postgres", "-d", "portail_rh"],
    {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
      encoding: "utf8",
    }
  )

  console.log(
    `Seed demo aligne: ${
      1 + roster.chefs.length + roster.collaborators.length
    } employes, ${skillCatalog.length} competences, ${
      Object.values(collaboratorProfiles).reduce(
        (total, profile) =>
          total +
          Object.keys(profile.soft).length +
          Object.keys(profile.technical).length,
        0
      )
    } competences courantes, ${historyEntries.length} lignes d'historique post-onboarding, ${
      demoProjects.length
    } projets, ${demoTasks.length} taches et ${
      demoTasks.reduce((total, task) => total + task.requiredSkills.length, 0)
    } competences techniques requises de tache.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
