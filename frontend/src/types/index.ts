import type { ReactNode, FormEvent } from "react";
export interface AuthUser {
  UID: number;
  username: string;
  first_name: string;
  last_name?: string;
  email?: string;
  Matricule: string;
  roles: string[];
  isAdmin: boolean;
  must_change_password: boolean;
  permissions: Record<string, Record<string, boolean>>;
}
export type DataRow = Record<string, any>;
export type TableColumn = [
  key: string,
  label: string,
  format?: (value: any, row: DataRow) => ReactNode,
];
export interface TableProps {
  rows: DataRow[];
  columns: TableColumn[];
  id: string;
  title?: string;
  actions?: (row: DataRow) => ReactNode;
}
export interface LoginProps {
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
}
export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}
