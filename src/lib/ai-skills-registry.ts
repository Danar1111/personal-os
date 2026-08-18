export interface RegisteredAISkill {
  name: string;
  module: string;
  description: string;
  examplePrompt: string;
}

export const OMNI_AI_SKILLS_REGISTRY: RegisteredAISkill[] = [
  // ── SECOND BRAIN VAULT & FOLDERS ─────────────────────────────────────
  {
    name: "search_vault",
    module: "Second Brain Vault",
    description: "Searches Markdown Zettelkasten notes by keyword, title, or folder path.",
    examplePrompt: "Carikan note tentang Next.js di folder Architecture",
  },
  {
    name: "create_note",
    module: "Second Brain Vault",
    description: "Creates a new note inside Second Brain Vault with optional folder path assignment.",
    examplePrompt: "Buat note baru 'System Architecture' di folder Work/Projects",
  },
  {
    name: "update_note",
    module: "Second Brain Vault",
    description: "Edits full details of a note (title, content, tags, category, or folder).",
    examplePrompt: "Edit note 'System Architecture' dan tambahkan tag #drizzle #mysql",
  },
  {
    name: "move_note_to_folder",
    module: "Second Brain Vault",
    description: "Moves an existing note to a specified target folder path or root level.",
    examplePrompt: "Pindahkan note 'Database Specs' ke folder Architecture",
  },
  {
    name: "delete_note",
    module: "Second Brain Vault",
    description: "Deletes a note from Second Brain Vault after user confirmation.",
    examplePrompt: "Hapus note 'Old Scratchpad'",
  },
  {
    name: "list_folders",
    module: "Second Brain Vault",
    description: "Browses and lists all existing folders and nested tree structures.",
    examplePrompt: "Tampilkan semua folder yang ada di Second Brain",
  },
  {
    name: "create_folder",
    module: "Second Brain Vault",
    description: "Creates a new folder or nested folder path (e.g. Work/Projects/Frontend).",
    examplePrompt: "Buat folder baru Work/Projects/Backend",
  },
  {
    name: "rename_folder",
    module: "Second Brain Vault",
    description: "Renames an existing folder in Second Brain Vault.",
    examplePrompt: "Rename folder 'Docs' menjadi 'Documentation'",
  },
  {
    name: "move_folder",
    module: "Second Brain Vault",
    description: "Moves a folder into another target folder or reparents to root level.",
    examplePrompt: "Pindahkan folder 'Specs' ke dalam folder 'Work'",
  },
  {
    name: "delete_folder",
    module: "Second Brain Vault",
    description: "Deletes a folder and all its subfolders and notes after user confirmation.",
    examplePrompt: "Hapus folder 'Old Projects'",
  },

  // ── TASK OMNI-KANBAN & PROJECTS ─────────────────────────────────────
  {
    name: "list_tasks",
    module: "Task Omni-Kanban",
    description: "Lists tasks filtered by status (todo, in_progress, completed, done, all).",
    examplePrompt: "Tunjukkan daftar task yang sedang dikerjakan (in progress)",
  },
  {
    name: "list_projects",
    module: "Task Omni-Kanban",
    description: "Lists all projects in Task Omni-Kanban with status and task count statistics.",
    examplePrompt: "Tampilkan daftar semua project yang ada di Kanban",
  },
  {
    name: "create_task",
    module: "Task Omni-Kanban",
    description: "Creates a new Kanban task with priority, description, and project assignment.",
    examplePrompt: "Buat task high priority 'Setup Tailwind CSS' under project Personal OS",
  },
  {
    name: "update_task",
    module: "Task Omni-Kanban",
    description: "Edits full details of a task (title, description, priority, status, or project).",
    examplePrompt: "Edit task 'Setup Tailwind CSS' ubah priority jadi medium",
  },
  {
    name: "update_task_status",
    module: "Task Omni-Kanban",
    description: "Quickly shifts task status between todo, in_progress, and done.",
    examplePrompt: "Tandai task 'Setup Tailwind CSS' sebagai selesai (done)",
  },
  {
    name: "add_task_reference",
    module: "Task Omni-Kanban",
    description: "Attaches a reference link (Asset, Drive, Note, External Link) to a task description.",
    examplePrompt: "Tambahkan reference note 'Database Specs' ke task 'Refactor DB'",
  },
  {
    name: "move_task_to_project",
    module: "Task Omni-Kanban",
    description: "Assigns or moves a task to a target project.",
    examplePrompt: "Pindahkan task 'Setup Tailwind' ke project 'Website v2'",
  },
  {
    name: "delete_task",
    module: "Task Omni-Kanban",
    description: "Deletes a task from Omni-Kanban after user confirmation.",
    examplePrompt: "Hapus task 'Unused task'",
  },
  {
    name: "create_project",
    module: "Task Omni-Kanban",
    description: "Creates a new project in Omni-Kanban.",
    examplePrompt: "Buat project baru 'Personal OS v3'",
  },
  {
    name: "rename_project",
    module: "Task Omni-Kanban",
    description: "Renames an existing project while keeping all linked tasks safe.",
    examplePrompt: "Rename project 'Personal OS v2' menjadi 'Personal OS Production'",
  },
  {
    name: "delete_project",
    module: "Task Omni-Kanban",
    description: "Deletes a project and all tasks linked to it after user confirmation.",
    examplePrompt: "Hapus project 'Demo App'",
  },

  // ── ASSET VAULT & BOOKMARKS ──────────────────────────────────────────
  {
    name: "list_assets",
    module: "Asset Vault",
    description: "Lists bookmarks, web links, resources, and saved media in Asset Vault.",
    examplePrompt: "Tampilkan semua bookmark link di Asset Vault",
  },
  {
    name: "search_assets",
    module: "Asset Vault",
    description: "Searches bookmarks, web links, and media resources by title, keyword, or URL.",
    examplePrompt: "Carikan bookmark tentang Tailwind CSS",
  },
  {
    name: "log_asset",
    module: "Asset Vault",
    description: "Saves a new link, file reference, or media resource to Asset Vault.",
    examplePrompt: "Simpan link https://nextjs.org/docs dengan judul 'Next.js Docs'",
  },
  {
    name: "update_asset",
    module: "Asset Vault",
    description: "Edits details of an existing bookmark or resource (title, type, URL, tags).",
    examplePrompt: "Edit asset 'Next.js Docs' tambahkan tag #frontend",
  },
  {
    name: "delete_asset",
    module: "Asset Vault",
    description: "Deletes a bookmark or asset from Asset Vault after user confirmation.",
    examplePrompt: "Hapus asset 'Old Docs Link'",
  },

  // ── SKILL MATRIX & LEARNING ──────────────────────────────────────────
  {
    name: "list_skills",
    module: "Skill Matrix",
    description: "Lists all skills currently tracked or being learned in Skill Matrix.",
    examplePrompt: "Daftar skill apa saja yang sedang saya pelajari?",
  },
  {
    name: "search_skills",
    module: "Skill Matrix",
    description: "Searches skills by title, keyword, or learning category.",
    examplePrompt: "Cari skill 'TypeScript' di Skill Matrix",
  },
  {
    name: "log_skill",
    module: "Skill Matrix",
    description: "Logs a new skill to track with proficiency, category, and target status.",
    examplePrompt: "Tambah skill baru 'Rust' dengan level beginner di kategori hard_skill",
  },
  {
    name: "update_skill",
    module: "Skill Matrix",
    description: "Edits full details of a skill (title, description, category, proficiency, status).",
    examplePrompt: "Ubah level skill 'TypeScript' menjadi advanced",
  },
  {
    name: "add_skill_reference",
    module: "Skill Matrix",
    description: "Attaches a reference link (Asset, Drive, Note, External Link) to a skill.",
    examplePrompt: "Hubungkan note 'Rust Study Guide' ke skill 'Rust'",
  },
  {
    name: "delete_skill",
    module: "Skill Matrix",
    description: "Deletes a skill from Skill Matrix after user confirmation.",
    examplePrompt: "Hapus skill 'Legacy PHP'",
  },
  {
    name: "add_milestone",
    module: "Skill Matrix",
    description: "Adds a new milestone goal to a skill syllabus.",
    examplePrompt: "Tambah milestone 'Pahami Ownership & Borrowing' ke skill Rust",
  },
  {
    name: "update_milestone",
    module: "Skill Matrix",
    description: "Edits milestone description or completion status.",
    examplePrompt: "Tandai milestone 'Pahami Ownership' sebagai selesai",
  },
  {
    name: "list_milestones",
    module: "Skill Matrix",
    description: "Lists all milestones and completion progress for a skill.",
    examplePrompt: "Lihat milestone untuk skill Rust",
  },
  {
    name: "delete_milestone",
    module: "Skill Matrix",
    description: "Deletes a milestone goal from a skill syllabus.",
    examplePrompt: "Hapus milestone 'Tugas lama' dari skill Rust",
  },

  // ── APP LAUNCHER & SHORTCUTS ─────────────────────────────────────────
  {
    name: "list_applications",
    module: "App Launcher",
    description: "Lists registered web applications, local services, and shortcuts.",
    examplePrompt: "Tampilkan aplikasi terdaftar di App Launcher",
  },
  {
    name: "register_application",
    module: "App Launcher",
    description: "Registers a new web app, local service, or shortcut in App Launcher.",
    examplePrompt: "Daftarkan aplikasi 'n8n' dengan URL http://localhost:5678",
  },
  {
    name: "update_application",
    module: "App Launcher",
    description: "Edits details of a registered app (name, URL, icon, category).",
    examplePrompt: "Ubah URL aplikasi 'n8n' ke https://n8n.my-server.com",
  },
  {
    name: "delete_application",
    module: "App Launcher",
    description: "Deletes a registered app shortcut after user confirmation.",
    examplePrompt: "Hapus app 'Unused Service'",
  },

  // ── FINANCE HUB ──────────────────────────────────────────────────────
  {
    name: "log_transaction",
    module: "Finance Hub",
    description: "Logs an income or expense transaction to Finance Hub ledger.",
    examplePrompt: "Catat pengeluaran $25 untuk Makan Siang di Finance Hub",
  },
  {
    name: "list_transactions",
    module: "Finance Hub",
    description: "Shows recent financial transactions filtered by type or limit.",
    examplePrompt: "Tampilkan 10 transaksi pengeluaran terbaru",
  },
  {
    name: "delete_transaction",
    module: "Finance Hub",
    description: "Deletes a transaction record after user confirmation.",
    examplePrompt: "Hapus transaksi 'Makan Siang $25'",
  },

  // ── MASTER CALENDAR ──────────────────────────────────────────────────
  {
    name: "create_calendar_event",
    module: "Master Calendar",
    description: "Schedules a time-blocked event in Master Calendar.",
    examplePrompt: "Jadwalkan event 'Meeting Client' besok jam 10 pagi selama 60 menit",
  },
  {
    name: "update_calendar_event",
    module: "Master Calendar",
    description: "Edits title, start time, duration, or event type of a calendar event.",
    examplePrompt: "Ubah jadwal 'Meeting Client' jadi jam 2 siang",
  },
  {
    name: "list_calendar_events",
    module: "Master Calendar",
    description: "Lists upcoming scheduled calendar events.",
    examplePrompt: "Apa saja jadwal kegiatan saya hari ini?",
  },
  {
    name: "delete_calendar_event",
    module: "Master Calendar",
    description: "Deletes a scheduled event from Master Calendar after confirmation.",
    examplePrompt: "Hapus jadwal 'Meeting Client'",
  },

  // ── TMDB WATCHLIST ───────────────────────────────────────────────────
  {
    name: "list_watchlist",
    module: "TMDB Watchlist",
    description: "Lists saved movies in TMDB Watchlist.",
    examplePrompt: "Tampilkan daftar film yang disimpan di Watchlist",
  },
  {
    name: "add_to_watchlist",
    module: "TMDB Watchlist",
    description: "Searches TMDB for a movie and saves it to TMDB Watchlist.",
    examplePrompt: "Cari dan simpan film 'Inception' ke Watchlist",
  },
  {
    name: "delete_watchlist_item",
    module: "TMDB Watchlist",
    description: "Removes a movie from TMDB Watchlist after user confirmation.",
    examplePrompt: "Hapus film 'Inception' dari Watchlist",
  },

  // ── EXTERNAL INTELLIGENCE SKILLS ─────────────────────────────────────
  {
    name: "search_tmdb_movies",
    module: "External Intelligence",
    description: "Searches TMDB database for movies, ratings, overviews, and release dates.",
    examplePrompt: "Carikan info film Christopher Nolan terbaru",
  },
  {
    name: "get_trending_movies",
    module: "External Intelligence",
    description: "Fetches currently trending movies worldwide from TMDB.",
    examplePrompt: "Rekomendasikan film yang sedang trending saat ini",
  },
  {
    name: "fetch_news_articles",
    module: "External Intelligence",
    description: "Fetches real-time news headlines on any query topic.",
    examplePrompt: "Berikan berita terbaru tentang AI and Artificial Intelligence",
  },
  {
    name: "get_stock_quote",
    module: "External Intelligence",
    description: "Fetches live market quotes for stocks or crypto tickers (e.g. AAPL, NVDA, BTC).",
    examplePrompt: "Berapa harga saham AAPL dan NVDA hari ini?",
  },
  {
    name: "analyze_market_sentiment",
    module: "External Intelligence",
    description: "Analyzes real-time market sentiment and financial headlines for a stock ticker.",
    examplePrompt: "Analisa sentimen pasar untuk saham NVDA",
  },

  // ── PERSONAL KNOWLEDGE VAULT ─────────────────────────────────────────
  {
    name: "save_knowledge",
    module: "Personal Knowledge Vault",
    description: "Saves a new entry (bio, brand voice, preferences, guidelines, or sensitive secrets) into Knowledge Vault.",
    examplePrompt: "Simpan di Knowledge Vault preferensi UI saya selalu Dark Mode",
  },
  {
    name: "search_knowledge",
    module: "Personal Knowledge Vault",
    description: "Searches or lists entries stored in Personal Knowledge Vault.",
    examplePrompt: "Carikan entri NIK atau preferensi UI saya di Knowledge Vault",
  },
  {
    name: "update_knowledge",
    module: "Personal Knowledge Vault",
    description: "Updates an existing entry in Personal Knowledge Vault.",
    examplePrompt: "Ubah entri Brand Voice di Knowledge Vault menjadi 'Forge25 Warm Voice'",
  },
  {
    name: "delete_knowledge",
    module: "Personal Knowledge Vault",
    description: "Deletes an entry from Personal Knowledge Vault after user confirmation.",
    examplePrompt: "Hapus entri WiFi Password dari Knowledge Vault",
  },

  // ── OMNI-EMAILER SYSTEM ─────────────────────────────────────────────
  {
    name: "send_email",
    module: "Omni-Emailer System",
    description: "Sends an email to a recipient via Brevo SMTP API with optional handlebars variables or templateId.",
    examplePrompt: "Kirimkan email ke priyambodo02@gmail.com dengan subjek 'Test Email' dan isi 'Halo Danar, sistem online!'",
  },
  {
    name: "list_email_templates",
    module: "Omni-Emailer System",
    description: "Lists all saved email templates in Omni-Emailer Studio.",
    examplePrompt: "Tunjukkan daftar template email yang tersimpan di Omni-Emailer",
  },
  {
    name: "create_email_template",
    module: "Omni-Emailer System",
    description: "Creates a new email template in Omni-Emailer Studio.",
    examplePrompt: "Buat template email baru 'Invoice Notification' dengan subjek 'Tagihan {{invoice_number}}'",
  },

  // ── GOOGLE DRIVE & WEB INTELLIGENCE ────────────────────────────────
  {
    name: "search_google_drive",
    module: "Google Drive Storage",
    description: "Searches connected Google Drive for files, documents, or assets by keyword.",
    examplePrompt: "Cari dokumen invoice atau project plan di Google Drive saya",
  },
  {
    name: "web_search",
    module: "External Intelligence",
    description: "Performs real-time web search for information, facts, or news.",
    examplePrompt: "Carikan informasi terbaru mengenai rilis Next.js",
  },
];
