export interface Skill {
  name: string
  rating: number
}

export interface Employee {
  id: number
  name: string
  email: string
  department: string
  skills: Skill[]
}

export interface SkillDefinition {
  id: number
  name: string
  description: string
}

export interface Article {
  id: number
  title: string
  description: string
  author: string
  skills: string[]
  timestamp: string
  contributors?: string[]
  attachments?: string[]
}

export let mockEmployees: Employee[] = [
  {
    id: 1, name: 'Ada Lovelace', email: 'ada@example.com', department: 'Digitalization',
    skills: [{ name: 'python', rating: 9 }, { name: 'mathematics', rating: 10 }, { name: 'algorithms', rating: 9 }],
  },
  {
    id: 2, name: 'Grace Hopper', email: 'grace@example.com', department: 'Engineering',
    skills: [{ name: 'cobol', rating: 10 }, { name: 'leadership', rating: 8 }, { name: 'compiler design', rating: 9 }],
  },
  {
    id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Infrastructure',
    skills: [{ name: 'linux', rating: 10 }, { name: 'git', rating: 10 }, { name: 'c', rating: 10 }],
  },
  {
    id: 4, name: 'Marie Curie', email: 'marie@example.com', department: 'Research',
    skills: [{ name: 'chemistry', rating: 10 }, { name: 'physics', rating: 10 }, { name: 'data analysis', rating: 8 }],
  },
  {
    id: 5, name: 'Alan Turing', email: 'alan@example.com', department: 'Digitalization',
    skills: [{ name: 'algorithms', rating: 10 }, { name: 'cryptography', rating: 9 }, { name: 'python', rating: 7 }],
  },
  {
    id: 6, name: 'Katherine Johnson', email: 'katherine@example.com', department: 'Research',
    skills: [{ name: 'mathematics', rating: 10 }, { name: 'data analysis', rating: 9 }, { name: 'physics', rating: 8 }],
  },
  {
    id: 7, name: 'Dennis Ritchie', email: 'dennis@example.com', department: 'Engineering',
    skills: [{ name: 'c', rating: 10 }, { name: 'unix', rating: 10 }, { name: 'systems design', rating: 9 }],
  },
  {
    id: 8, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Engineering',
    skills: [{ name: 'software architecture', rating: 10 }, { name: 'python', rating: 7 }, { name: 'leadership', rating: 8 }],
  },
  {
    id: 9, name: 'Tim Berners-Lee', email: 'tim@example.com', department: 'Digitalization',
    skills: [{ name: 'web technologies', rating: 10 }, { name: 'systems design', rating: 9 }, { name: 'leadership', rating: 7 }],
  },
  {
    id: 10, name: 'Bjarne Stroustrup', email: 'bjarne@example.com', department: 'Infrastructure',
    skills: [{ name: 'c++', rating: 10 }, { name: 'systems design', rating: 9 }, { name: 'compiler design', rating: 8 }],
  },
]

export let mockArticles: Article[] = [
  {
    id: 1,
    title: 'Introduction to Python for Data Analysis',
    description: 'A comprehensive guide to using Python for data processing and analysis in a corporate environment.',
    author: 'Ada Lovelace',
    skills: ['python', 'data analysis', 'mathematics'],
    timestamp: '2026-09-10T10:00:00Z',
  },
  {
    id: 2,
    title: 'Linux Kernel Architecture Overview',
    description: 'Deep dive into the Linux kernel architecture, process management, and memory subsystems.',
    author: 'Linus Torvalds',
    skills: ['linux', 'c', 'systems design'],
    timestamp: '2026-09-15T14:30:00Z',
  },
  {
    id: 3,
    title: 'Compiler Design Fundamentals',
    description: 'From lexer to code generation: building a compiler from scratch, with real-world examples.',
    author: 'Grace Hopper',
    skills: ['compiler design', 'cobol', 'algorithms'],
    timestamp: '2026-09-18T09:00:00Z',
  },
  {
    id: 4,
    title: 'Cryptography in Modern Systems',
    description: 'Practical applications of cryptographic algorithms in modern software systems.',
    author: 'Alan Turing',
    skills: ['cryptography', 'algorithms', 'mathematics'],
    timestamp: '2026-09-20T11:15:00Z',
  },
  {
    id: 5,
    title: 'Data Analysis Best Practices',
    description: 'Statistical methods and tooling for reliable data analysis in research contexts.',
    author: 'Katherine Johnson',
    skills: ['data analysis', 'mathematics', 'physics'],
    timestamp: '2026-09-22T16:00:00Z',
  },
  {
    id: 6,
    title: 'Modern Software Architecture Patterns',
    description: 'An overview of SOLID principles, DDD, and clean architecture for large-scale systems.',
    author: 'Barbara Liskov',
    skills: ['software architecture', 'systems design', 'leadership'],
    timestamp: '2026-09-23T08:45:00Z',
  },
]

export let mockSkillDefs: SkillDefinition[] = [
  { id: 1,  name: 'python',              description: 'General-purpose scripting and data science language.' },
  { id: 2,  name: 'mathematics',         description: 'Applied and pure mathematics including statistics and linear algebra.' },
  { id: 3,  name: 'algorithms',          description: 'Design and analysis of computational algorithms and data structures.' },
  { id: 4,  name: 'cobol',               description: 'COBOL programming for enterprise batch processing systems.' },
  { id: 5,  name: 'leadership',          description: 'Team management, mentoring, and stakeholder communication.' },
  { id: 6,  name: 'compiler design',     description: 'Lexing, parsing, IR generation, and code optimisation.' },
  { id: 7,  name: 'linux',               description: 'Linux kernel internals, shell scripting, and system administration.' },
  { id: 8,  name: 'git',                 description: 'Version control, branching strategies, and collaborative workflows.' },
  { id: 9,  name: 'c',                   description: 'Low-level systems programming in C.' },
  { id: 10, name: 'chemistry',           description: 'Organic and inorganic chemistry, laboratory methods.' },
  { id: 11, name: 'physics',             description: 'Classical and modern physics; experimental design.' },
  { id: 12, name: 'data analysis',       description: 'Statistical analysis, visualisation, and insight extraction.' },
  { id: 13, name: 'cryptography',        description: 'Symmetric/asymmetric encryption, hashing, and PKI.' },
  { id: 14, name: 'c',                   description: 'Systems and low-level programming in C.' },
  { id: 15, name: 'unix',               description: 'UNIX architecture, IPC, and POSIX standards.' },
  { id: 16, name: 'systems design',      description: 'Distributed systems architecture, scalability, and reliability.' },
  { id: 17, name: 'software architecture', description: 'SOLID principles, design patterns, and clean architecture.' },
  { id: 18, name: 'web technologies',    description: 'HTML, CSS, HTTP, REST, and browser internals.' },
  { id: 19, name: 'c++',                 description: 'Object-oriented and systems programming in C++.' },
]

// de-duplicate by name so the c/unix entries don't appear twice
mockSkillDefs = mockSkillDefs.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i)
mockSkillDefs.forEach((s, i) => { s.id = i + 1 })

export function getDepartments() {
  return [...new Set(mockEmployees.map(e => e.department))]
}

export const departments = getDepartments()

export function nextEmployeeId() {
  return Math.max(0, ...mockEmployees.map(e => e.id)) + 1
}

export function nextArticleId() {
  return Math.max(0, ...mockArticles.map(a => a.id)) + 1
}

export function nextSkillDefId() {
  return Math.max(0, ...mockSkillDefs.map(s => s.id)) + 1
}
