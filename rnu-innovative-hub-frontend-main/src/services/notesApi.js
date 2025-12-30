// src/services/notesApi.js
import { Contract } from "./contract";
import { call } from "./api";

/**
 * Notes API
 * Lecturer writes, Student reads
 * Contract-driven, backend-ready
 *
 * IMPORTANT:
 * - Components MUST NOT touch localStorage
 * - Notes change events are emitted HERE
 */

const NOTES_EVENT = "rnu_notes_updated";
const CHANNEL_NAME = "rnu_notes_channel";

function emitNotesUpdated() {
  window.dispatchEvent(new Event(NOTES_EVENT));

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: NOTES_EVENT });
    channel.close();
  } catch {
    // BroadcastChannel not supported → ignore
  }
}

export const notesApi = {
  /**
   * Get all notes for a student
   * @param {string} studentEmail
   * @returns Promise<{ notes: Array }>
   */
  getNotes(studentEmail) {
    return call(Contract.notes.list, {
      params: { email: studentEmail },
    });
  },

  /**
   * Create a new note
   * @param {string} studentEmail
   * @param {{ text: string }} payload
   */
  async createNote(studentEmail, payload) {
    const res = await call(Contract.notes.create, {
      params: { email: studentEmail },
      body: payload,
    });

    emitNotesUpdated();
    return res;
  },

  /**
   * Update an existing note
   * @param {string} studentEmail
   * @param {string} noteId
   * @param {{ text: string }} payload
   */
  async updateNote(studentEmail, noteId, payload) {
    const res = await call(Contract.notes.update, {
      params: { email: studentEmail, id: noteId },
      body: payload,
    });

    emitNotesUpdated();
    return res;
  },

  /**
   * Delete a note
   * @param {string} studentEmail
   * @param {string} noteId
   */
  async deleteNote(studentEmail, noteId) {
    const res = await call(Contract.notes.remove, {
      params: { email: studentEmail, id: noteId },
    });

    emitNotesUpdated();
    return res;
  },
};
