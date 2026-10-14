export type Language = "en" | "hi" | "kn";

export type IconName =
  | "mic"
  | "camera"
  | "shield"
  | "check"
  | "speaker"
  | "chevron"
  | "arrow"
  | "headset"
  | "phone"
  | "location"
  | "lock"
  | "document"
  | "alert"
  | "copy"
  | "whatsapp"
  | "user"
  | "refresh"
  | "close";

export interface DocumentIssue {
  id: string;
  title: string;
  description: string;
  actionText: string;
  hasDocumentComparison?: boolean;
}
