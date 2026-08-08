"use server";

import { db } from "@/db";
import { applications } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getApplications() {
  try {
    const apps = await db.select().from(applications).orderBy(desc(applications.createdAt));
    return apps;
  } catch (error) {
    console.error("[getApplications error]:", error);
    return [];
  }
}
