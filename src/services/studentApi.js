// src/services/studentApi.js
import { requestByContract } from "./api";
import { Contract } from "./contract";

// Student API client (frontend-only)
// Single source of truth: Contract (src/services/contract.js)

export const studentApi = {
  // Achievements
  // Contract: GET /users/:email/achievements
  getItems: (email, category = "all") =>
    requestByContract(Contract.achievements.list, {
      params: { email },
      query: { category },
    }),

  // Contract: POST /users/:email/achievements
  // expects: { category, item }
  addItem: (email, category, item) =>
    requestByContract(Contract.achievements.create, {
      params: { email },
      body: { category, item },
    }),

  // Contract: DELETE /users/:email/achievements/:id?category=x
  removeItem: (email, category, id) =>
    requestByContract(Contract.achievements.remove, {
      params: { email, id },
      query: { category },
    }),

  // Stats
  // Contract: GET /users/:email/stats
  getStats: (email) =>
    requestByContract(Contract.achievements.stats, {
      params: { email },
    }),
};
