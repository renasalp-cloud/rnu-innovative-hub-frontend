// src/services/contracts.js
// BACKWARD-COMPAT BRIDGE
// ✅ Single source of truth is now: src/services/contract.js (export: Contract)
// This file exists only to avoid breaking older imports:
//   import { contracts } from "./contracts";

import { Contract } from "./contract";

/**
 * Map legacy endpoints to the new Contract structure.
 * Keep keys stable so existing code does not break.
 */
export const contracts = {
  auth: {
    login: Contract.auth.login,
    register: Contract.auth.register,
    me: Contract.auth.me,
  },

  // Legacy "student" group used "/students/me/*"
  // New contract uses "/users/:email/*"
  // NOTE: We keep these for compatibility, but prefer using Contract directly in new code.
  student: {
    // IMPORTANT:
    // These legacy paths are not part of Contract; they were old mock endpoints.
    // We provide equivalents using the new Contract where possible.
    // Callers should pass `email` via params in new API clients (studentApi already updated).
    getItems: Contract.achievements.list,
    addItem: Contract.achievements.create,
    removeItem: Contract.achievements.remove,
    getStats: Contract.achievements.stats,
  },

  lecturer: {
    // Your Contract has: lecturer.students.*
    getMyStudents: Contract.lecturer.students.list,
    addStudent: Contract.lecturer.students.add,

    // Notes: Contract.notes.* uses /students/:email/notes
    // Old code used /lecturer/notes/:studentEmail
    // We map to the new structure.
    getStudentNotes: Contract.notes.list,
    addStudentNote: Contract.notes.create,
  },
};
