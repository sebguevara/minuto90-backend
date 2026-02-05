import * as repo from "../infrastructure/stats.repo";

export async function getTableCategories() {
  const items = await repo.listTableCategories();
  return { data: items };
}

export async function getTableSections() {
  const items = await repo.listTableSections();
  return { data: items };
}

export async function getTableTypes() {
  const items = await repo.listTableTypes();
  return { data: items };
}

