import { mysqlTable, int, varchar, text, timestamp, decimal, boolean, date } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const projects = mysqlTable('projects', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('PLANNING'), // 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  startDate: date('start_date', { mode: 'string' }),
  targetDate: date('target_date', { mode: 'string' }),
  coverUrl: text('cover_url'),
  icon: text('icon'),
  isHub: boolean('is_hub').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projectPhases = mysqlTable('project_phases', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PLANNED'), // 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'
  orderIndex: int('order_index').notNull().default(0),
  dependsOnPhaseId: int('depends_on_phase_id'),
  progress: int('progress').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tasks = mysqlTable('tasks', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').references(() => projects.id, { onDelete: 'set null' }),
  phaseId: int('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('todo'),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),
  position: int('position').notNull().default(0),
  dueDate: timestamp('due_date'),
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
  sizeBytes: int('size_bytes'),
  syncStatus: varchar('sync_status', { length: 50 }).notNull().default('LOCAL_UNSYNCED'), // 'LOCAL_UNSYNCED' | 'SYNCED_LOCAL_KEPT' | 'CLOUD_ONLY'
  gdriveId: varchar('gdrive_id', { length: 255 }),
  // Project Hub document metadata (nullable — only set when asset is a project document)
  projectId: int('project_id').references(() => projects.id, { onDelete: 'set null' }),
  phaseId: int('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  docVersion: varchar('doc_version', { length: 50 }),
  docStatus: varchar('doc_status', { length: 50 }), // 'DRAFT' | 'FINAL'
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
  isSecret: boolean('is_secret').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const emailTemplates = mysqlTable('email_templates', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  bodyHtml: text('body_html').notNull(),
  variables: text('variables'), // JSON string array e.g. ["client_name", "invoice_link"]
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
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

export const projectAssetLinks = mysqlTable('project_asset_links', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  assetId: int('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  phaseId: int('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  docVersion: varchar('doc_version', { length: 50 }).default('v1.0'),
  docStatus: varchar('doc_status', { length: 50 }).default('DRAFT'), // 'DRAFT' | 'FINAL'
  createdAt: timestamp('created_at').defaultNow(),
});

export const projectAssetLinksRelations = relations(projectAssetLinks, ({ one }) => ({
  project: one(projects, {
    fields: [projectAssetLinks.projectId],
    references: [projects.id],
  }),
  asset: one(assets, {
    fields: [projectAssetLinks.assetId],
    references: [assets.id],
  }),
  phase: one(projectPhases, {
    fields: [projectAssetLinks.phaseId],
    references: [projectPhases.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  phases: many(projectPhases),
  assets: many(assets),
  assetLinks: many(projectAssetLinks),
}));

export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
  assets: many(assets),
  assetLinks: many(projectAssetLinks),
}));

export const assetsRelations = relations(assets, ({ many }) => ({
  projectLinks: many(projectAssetLinks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  phase: one(projectPhases, {
    fields: [tasks.phaseId],
    references: [projectPhases.id],
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

export const knowledgeVault = mysqlTable('knowledge_vault', {
  id: varchar('id', { length: 36 }).primaryKey(),
  category: varchar('category', { length: 50 }).notNull().default('Preferences'),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  isSensitive: boolean('is_sensitive').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type NewProjectPhase = typeof projectPhases.$inferInsert;
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
export type KnowledgeEntry = typeof knowledgeVault.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeVault.$inferInsert;
export const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('info'), // 'info' | 'success' | 'warning' | 'error'
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── DAILY ROUTINE & 24H DAY TRACKER TABLES ──────────────────────────────────
export const dailyRoutineMaster = mysqlTable('daily_routine_master', {
  id: int('id').autoincrement().primaryKey(),
  dayProfile: varchar('day_profile', { length: 50 }).notNull().default('WEEKDAY'), // 'WEEKDAY' | 'FRIDAY' | 'WEEKEND'
  startTime: varchar('start_time', { length: 10 }).notNull(), // 'HH:mm'
  endTime: varchar('end_time', { length: 10 }).notNull(),   // 'HH:mm'
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull().default('ROUTINE'), // 'DEEP_WORK' | 'MEETING' | 'HEALTH' | 'PRAYER' | 'BUSINESS' | 'ROUTINE'
  color: varchar('color', { length: 50 }),
  orderIndex: int('order_index').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dailyTimeblockInstances = mysqlTable('daily_timeblock_instances', {
  id: int('id').autoincrement().primaryKey(),
  date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull().default('ROUTINE'),
  status: varchar('status', { length: 50 }).notNull().default('PLANNED'), // 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
  taskId: int('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  notes: text('notes'),
  orderIndex: int('order_index').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dailyHabits = mysqlTable('daily_habits', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 50 }).default('CheckCircle2'),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dailyHabitLogs = mysqlTable('daily_habit_logs', {
  id: int('id').autoincrement().primaryKey(),
  habitId: int('habit_id').notNull().references(() => dailyHabits.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type ProjectAssetLink = typeof projectAssetLinks.$inferSelect;
export type NewProjectAssetLink = typeof projectAssetLinks.$inferInsert;

export type DailyRoutineMaster = typeof dailyRoutineMaster.$inferSelect;
export type NewDailyRoutineMaster = typeof dailyRoutineMaster.$inferInsert;
export type DailyTimeblockInstance = typeof dailyTimeblockInstances.$inferSelect;
export type NewDailyTimeblockInstance = typeof dailyTimeblockInstances.$inferInsert;
export type DailyHabit = typeof dailyHabits.$inferSelect;
export type NewDailyHabit = typeof dailyHabits.$inferInsert;
export type DailyHabitLog = typeof dailyHabitLogs.$inferSelect;
export type NewDailyHabitLog = typeof dailyHabitLogs.$inferInsert;
