// src/services/contract.js
// Single source of truth for API contract (frontend-facing)
// Backend arrives later; UI should not guess shapes.

export const API_VERSION = "v1";

/**
 * Convention:
 * - All timestamps are ISO strings.
 * - IDs are strings (backend) even if local mode uses numbers.
 * - email is always lowercase and trimmed.
 */

export const Contract = {
  meta: {
    version: API_VERSION,
    base: "/api/v1",
  },

  auth: {
    register: {
      method: "POST",
      path: "/auth/register",
      request: {
        name: "string",
        email: "string",
        password: "string",
        role: "Student|Lecturer|Admin",
        department: "string",
      },
      response: {
        token: "string",
        user: "UserProfile",
      },
    },

    login: {
      method: "POST",
      path: "/auth/login",
      request: { email: "string", password: "string" },
      response: { token: "string", user: "UserProfile" },
    },

    me: {
      method: "GET",
      path: "/auth/me",
      headers: { Authorization: "Bearer <token>" },
      response: { user: "UserProfile" },
    },

    logout: {
      method: "POST",
      path: "/auth/logout",
      headers: { Authorization: "Bearer <token>" },
      response: { ok: true },
    },
  },

  profile: {
    get: {
      method: "GET",
      path: "/users/:email",
      response: { user: "UserProfile" },
    },

    update: {
      // IMPORTANT: in your UI only name+department can change
      method: "PATCH",
      path: "/users/:email",
      request: { name: "string", department: "string" },
      response: { user: "UserProfile" },
    },
  },

  achievements: {
    list: {
      method: "GET",
      path: "/users/:email/achievements",
      query: { category: "certifications|projects|publications|issues|all" },
      response: {
        items: "AchievementItem[]",
      },
    },

    create: {
      method: "POST",
      path: "/users/:email/achievements",
      request: {
        category: "certifications|projects|publications|issues",
        item: "AchievementItem",
      },
      response: { item: "AchievementItem" },
    },

    update: {
      method: "PATCH",
      path: "/users/:email/achievements/:id",
      request: { category: "string", patch: "partial AchievementItem" },
      response: { item: "AchievementItem" },
    },

    remove: {
      method: "DELETE",
      path: "/users/:email/achievements/:id",
      query: { category: "string" },
      response: { ok: true },
    },

    stats: {
      method: "GET",
      path: "/users/:email/stats",
      response: {
        stats: {
          certificates: "number",
          projects: "number",
          publications: "number",
          issues: "number",
        },
      },
    },
  },

  notes: {
    list: {
      method: "GET",
      path: "/students/:email/notes",
      response: { notes: "LecturerNote[]" },
    },

    create: {
      method: "POST",
      path: "/students/:email/notes",
      request: { text: "string" },
      response: { note: "LecturerNote" },
    },

    update: {
      method: "PATCH",
      path: "/students/:email/notes/:id",
      request: { text: "string" },
      response: { note: "LecturerNote" },
    },

    remove: {
      method: "DELETE",
      path: "/students/:email/notes/:id",
      response: { ok: true },
    },
  },

  ai: {
    chat: {
      method: "POST",
      path: "/ai/chat",
      request: {
        message: "string",
        // Optional: include context snapshot for rule-based engine
        context: {
          activeUserEmail: "string",
          role: "Student|Lecturer|Admin",
        },
      },
      response: {
        replyText: "string",
        // Optional structured payload
        data: "any|null",
      },
    },

    recommend: {
      method: "GET",
      path: "/ai/recommendations",
      query: { email: "string" },
      response: {
        recommendations: "string[]",
      },
    },
  },

  lecturer: {
    students: {
      list: {
        method: "GET",
        path: "/lecturers/:email/students",
        response: { students: "StudentSummary[]" },
      },

      add: {
        method: "POST",
        path: "/lecturers/:email/students",
        request: { studentEmail: "string" },
        response: { ok: true },
      },

      remove: {
        method: "DELETE",
        path: "/lecturers/:email/students/:studentEmail",
        response: { ok: true },
      },
    },

    supervision: {
      list: {
        method: "GET",
        path: "/lecturers/:email/supervisions",
        response: { items: "Supervision[]" },
      },
      upsert: {
        method: "POST",
        path: "/lecturers/:email/supervisions",
        request: {
          studentEmail: "string",
          thesisTopic: "string",
          level: "Bachelor|Master|PhD",
          status: "Proposal|Research|Defense|Completed",
          defenseDate: "ISO string|null",
        },
        response: { item: "Supervision" },
      },
    },
  },
};

// --- Shared "types" (documentation by example) ---
export const Examples = {
  UserProfile: {
    name: "Renas Alp",
    email: "renas@example.com",
    role: "Student",
    department: "Computer Science",
    createdAt: "2025-12-15T10:00:00.000Z",
    updatedAt: "2025-12-15T10:00:00.000Z",
  },

  AchievementItem: {
    id: "ach_123",
    title: "Example Title",
    description: "Optional description",
    link: "https://example.com",
    createdAt: "2025-12-15T10:00:00.000Z",
    // category-specific fields can live inside `meta`
    meta: {},
  },

  LecturerNote: {
    id: "note_123",
    studentEmail: "student@example.com",
    lecturerEmail: "lecturer@example.com",
    lecturerName: "Dr. Smith",
    text: "Good progress. Improve methodology section.",
    createdAt: "2025-12-15T10:00:00.000Z",
    editedAt: null,
  },

  StudentSummary: {
    email: "student@example.com",
    name: "Student Name",
    department: "Computer Science",
    totals: { certificates: 1, projects: 2, publications: 0, issues: 1 },
  },

  Supervision: {
    id: "sup_123",
    lecturerEmail: "lecturer@example.com",
    studentEmail: "student@example.com",
    thesisTopic: "Smart City IoT Security",
    level: "Master",
    status: "Research",
    defenseDate: null,
    updatedAt: "2025-12-15T10:00:00.000Z",
  },
};
