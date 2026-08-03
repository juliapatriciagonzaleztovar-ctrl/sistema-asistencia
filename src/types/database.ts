export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: "super_admin" | "operator";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  first_name: string;
  last_name: string;
  document: string | null;
  date_of_birth: string;
  age: number;
  group_id: string | null;
  shift: string;
  status: "active" | "inactive";
  observations: string | null;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  hire_date: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  study: string | null;
  hire_date: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface AttendanceChild {
  id: string;
  child_id: string;
  attendance_date: string;
  status: "present" | "absent";
  check_in: string | null;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceStaff {
  id: string;
  staff_id: string;
  staff_type: "teacher" | "practitioner";
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
  signature_url: string | null;
  registered_by: string | null;
  auto_marked: boolean | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ChildWithGroup extends Child {
  group: Group | null;
}

export interface AttendanceChildWithChild extends AttendanceChild {
  child: Child;
}

export interface AttendanceStaffWithDetails extends AttendanceStaff {
  teacher: Teacher | null;
  practitioner: Practitioner | null;
}

export interface DashboardStats {
  totalChildren: number;
  totalTeachers: number;
  totalPractitioners: number;
  todayPresent: number;
  todayAbsent: number;
  monthlyAttendance: Array<{ month: string; present: number; absent: number }>;
  yearlyStats: Array<{ year: string; present: number; absent: number }>;
}

export interface CorrectionRequest {
  id: string;
  attendance_id: string;
  staff_id: string;
  staff_type: "teacher" | "practitioner";
  staff_name: string;
  attendance_date: string;
  requested_by: string;
  requested_by_email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  resolved_by: string | null;
  resolved_by_email: string | null;
  created_at: string;
  resolved_at: string | null;
}