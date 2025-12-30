// src/services/lecturerApi.js
import { requestByContract } from "./api";
import { contracts } from "./contracts";

// Lecturer API client (frontend-only)

export const lecturerApi = {
  // Lecturer's student list
  getMyStudents: () => requestByContract(contracts.lecturer.getMyStudents),

  addStudent: (studentEmail) =>
    requestByContract(contracts.lecturer.addStudent, {
      body: { studentEmail },
    }),

  // Notes
  getStudentNotes: (studentEmail) =>
    requestByContract(contracts.lecturer.getStudentNotes, {
      params: { studentEmail },
    }),

  addStudentNote: (studentEmail, text) =>
    requestByContract(contracts.lecturer.addStudentNote, {
      params: { studentEmail },
      body: { text },
    }),
};
