export interface PreviewTask {
  title: string;
  description: string;
  assignedUserId: string;
  dueDate: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  comment: string | null;
}
