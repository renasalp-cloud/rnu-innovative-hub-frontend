// src/services/chatApi.js
import { call } from "./api";
import { Contract } from "./contract";

/**
 * AI Chat API (frontend-only shell)
 * Backend gelince sadece mock → real geçiş olur.
 */
export const chatApi = {
  /**
   * Send a chat message
   * @param {string} message
   * @param {object} context { activeUserEmail, role }
   */
  sendMessage(message, context) {
    return call(Contract.ai.chat, {
      body: {
        message,
        context: context || null,
      },
    });
  },

  /**
   * Optional: get recommendations
   */
  getRecommendations(email) {
    return call(Contract.ai.recommend, {
      query: { email },
    });
  },
};
