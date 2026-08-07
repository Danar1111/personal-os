"use server";

import { db } from "@/db";
import { applications, NewApplication } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getApplications() {
  try {
    const rows = await db
      .select()
      .from(applications)
      .orderBy(desc(applications.createdAt));
    return rows;
  } catch (error) {
    console.error("[getApplications error]:", error);
    return [];
  }
}

export async function createApplication(data: {
  name: string;
  url: string;
  iconName?: string;
  category?: string;
  useFavicon?: boolean;
}) {
  try {
    const name = data.name.trim();
    let url = data.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    const iconName = (data.iconName || "Globe").trim();
    const category = (data.category || "General").trim();
    const useFavicon = data.useFavicon ?? true;

    await db.insert(applications).values({
      name,
      url,
      iconName,
      category,
      useFavicon,
    });

    revalidatePath("/apps");
    revalidatePath("/");
    return { success: true, message: `Application "${name}" registered successfully!` };
  } catch (error: any) {
    console.error("[createApplication error]:", error);
    return { success: false, message: error.message || "Failed to create application" };
  }
}

export async function updateApplication(
  id: number,
  data: {
    name: string;
    url: string;
    iconName?: string;
    category?: string;
    useFavicon?: boolean;
  }
) {
  try {
    const name = data.name.trim();
    let url = data.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    const iconName = (data.iconName || "Globe").trim();
    const category = (data.category || "General").trim();
    const useFavicon = data.useFavicon ?? true;

    await db
      .update(applications)
      .set({ name, url, iconName, category, useFavicon })
      .where(eq(applications.id, id));

    revalidatePath("/apps");
    revalidatePath("/");
    return { success: true, message: `Application "${name}" updated!` };
  } catch (error: any) {
    console.error("[updateApplication error]:", error);
    return { success: false, message: error.message || "Failed to update application" };
  }
}

export async function deleteApplication(id: number) {
  try {
    await db.delete(applications).where(eq(applications.id, id));
    revalidatePath("/apps");
    revalidatePath("/");
    return { success: true, message: "Application deleted!" };
  } catch (error: any) {
    console.error("[deleteApplication error]:", error);
    return { success: false, message: error.message || "Failed to delete application" };
  }
}
