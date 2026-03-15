import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import CategoriesPage from "./screens/CategoriesPage";
import BookListPage from "./screens/BookListPage";
import FacultyDepartmentAdmin from "./screens/FacultyDepartmentAdmin";
import RegistrationTabs from "./screens/RegistrationTabs";
import GradeEntry from "./screens/GradeEntry";
import TermResult from "./screens/TermResult";
import StudentsTermList from "./screens/StudentsTermList";
import StaffMembers from "./screens/StaffMembers";
import Dashboard from "./screens/Dashboard";
import ScheduleAdmin from "./screens/ScheduleAdmin";
import UsersManagement from "./screens/UsersManagement";
import Login from "./screens/Login";
import Register from "./screens/Register";
import Certificates from "./screens/Certificates";
import AcademicRecord from "./screens/AcademicRecord";
import Reports from "./screens/Reports";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />  
        <Route path="/books" element={<BookListPage />} />
        <Route path="/faculty" element={<FacultyDepartmentAdmin />} />
        <Route path="/RegistrationTabs" element={<RegistrationTabs />} />
        <Route path="/GradeEntry" element={<GradeEntry />} />
        <Route path="/TermResult" element={<TermResult />} />
        <Route path="/StudentsTermList" element={<StudentsTermList />} />
        <Route path="/StaffMembers" element={<StaffMembers />} />
        <Route path="/dashboard" element={<Dashboard />} /> 
        <Route path="/schedule" element={<ScheduleAdmin />} />
        <Route path="/UsersManagement" element={<UsersManagement />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/academic-record" element={<AcademicRecord />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Router>
  );
}

export default App;