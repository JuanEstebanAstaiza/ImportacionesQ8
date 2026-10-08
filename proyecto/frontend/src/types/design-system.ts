import { ComponentPropsWithoutRef, ReactNode } from "react";

export type BadgeVariant = 
  | "created" | "directed" | "open" | "accepted" | "active-order" | "neutral"
  | "resp-nueva" | "resp-vista" | "resp-aceptada" | "resp-rechazada" 
  | "info" | "warning" | "success";

export type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

export type BtnSize = "sm" | "md" | "lg";

export interface BtnProps extends ComponentPropsWithoutRef<"button"> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export type ContactType = "chat" | "email";

export interface InputProps extends Omit<ComponentPropsWithoutRef<"input">, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode; // Ahora sí puedes usar ReactNode libremente
  suffix?: ReactNode;
  rightLabel?: ReactNode;
}

export interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  label?: string;
  error?: string;
  hint?: string;
}

export interface SelectProps extends ComponentPropsWithoutRef<"select"> {
  label?: string;
}

export interface TimelineStage {
  label: string;
  icon: ReactNode;
  status: "done" | "current" | "pending";
  date?: string;
}