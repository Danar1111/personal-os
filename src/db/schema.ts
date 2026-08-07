import { mysqlTable, int, varchar, text, timestamp, decimal, boolean } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const projects = mysqlTable('projects', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tasks = mysqlTable('tasks', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('todo'),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const transactions = mysqlTable('transactions', {
  id: int('id').autoincrement().primaryKey(),
  type: varchar('type', { length: 50 }).notNull().default('expense'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  category: varchar('category', { length: 100 }).notNull().default('General'),
  date: timestamp('date').defaultNow(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const skills = mysqlTable('skills', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull().default('hard_skill'),
  proficiency: varchar('proficiency', { length: 50 }).notNull().default('beginner'),
  status: varchar('status', { length: 50 }).notNull().default('learning'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const skillMilestones = mysqlTable('skill_milestones', {
  id: int('id').autoincrement().primaryKey(),
  skillId: int('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 255 }).notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const folders = mysqlTable('folders', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: int('parent_id').references((): any => folders.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notes = mysqlTable('notes', {
  id: int('id').autoincrement().primaryKey(),
  folderId: int('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 50 }).notNull().default('idea'),
  tags: varchar('tags', { length: 255 }).notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const assets = mysqlTable('assets', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('link'), // 'link' | 'pdf' | 'image' | 'video'
  urlOrPath: varchar('url_or_path', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  tags: varchar('tags', { length: 255 }).notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const calendarEvents = mysqlTable('calendar_events', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull().default('general'), // 'task' | 'learning' | 'general'
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemSettings = mysqlTable('system_settings', {
  id: int('id').autoincrement().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiSkills = mysqlTable('ai_skills', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  module: varchar('module', { length: 100 }).notNull(),
  description: text('description').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const applications = mysqlTable('applications', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  iconName: varchar('icon_name', { length: 100 }).notNull().default('Globe'),
  category: varchar('category', { length: 100 }).notNull().default('General'),
  useFavicon: boolean('use_favicon').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const watchlist = mysqlTable('watchlist', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  overview: text('overview'),
  posterPath: varchar('poster_path', { length: 500 }),
  tmdbId: int('tmdb_id').notNull(),
  rating: varchar('rating', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pinnedTickers = mysqlTable('pinned_tickers', {
  id: int('id').autoincrement().primaryKey(),
  symbol: varchar('symbol', { length: 50 }).notNull().unique(),
  sortOrder: int('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  milestones: many(skillMilestones),
}));

export const skillMilestonesRelations = relations(skillMilestones, ({ one }) => ({
  skill: one(skills, {
    fields: [skillMilestones.skillId],
    references: [skills.id],
  }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'parent_child',
  }),
  children: many(folders, {
    relationName: 'parent_child',
  }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  folder: one(folders, {
    fields: [notes.folderId],
    references: [folders.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillMilestone = typeof skillMilestones.$inferSelect;
export type NewSkillMilestone = typeof skillMilestones.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type AISkill = typeof aiSkills.$inferSelect;
export type NewAISkill = typeof aiSkills.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type WatchlistMovie = typeof watchlist.$inferSelect;
export type NewWatchlistMovie = typeof watchlist.$inferInsert;
export type PinnedTicker = typeof pinnedTickers.$inferSelect;
export type NewPinnedTicker = typeof pinnedTickers.$inferInsert;
