import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const PROJECTS_DIR = path.join(process.cwd(), "public", "generations");
const PROJECTS_FILE = path.join(PROJECTS_DIR, "projects.json");

export type Project = {
  id: string;
  name: string;
  createdAt: string;
};

async function ensureFile() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  try {
    await fs.access(PROJECTS_FILE);
  } catch {
    await fs.writeFile(PROJECTS_FILE, "[]", "utf-8");
  }
}

export async function listProjects(): Promise<Project[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(PROJECTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Project[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function writeAll(list: Project[]) {
  await ensureFile();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export async function createProject(name: string): Promise<Project> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  const list = await listProjects();
  if (list.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("project with that name already exists");
  }
  const project: Project = {
    id: `proj-${Date.now()}-${randomBytes(3).toString("hex")}`,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  list.push(project);
  await writeAll(list);
  return project;
}

export async function renameProject(id: string, name: string): Promise<Project | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  const list = await listProjects();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], name: trimmed };
  await writeAll(list);
  return list[idx];
}

export async function deleteProject(id: string): Promise<boolean> {
  const list = await listProjects();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}
