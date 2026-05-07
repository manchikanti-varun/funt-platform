export type EducationalBlockKind =
  | "callout.info"
  | "callout.warning"
  | "callout.tip"
  | "learning.objectives"
  | "summary"
  | "assignment"
  | "quiz.placeholder"
  | "discussion.prompt"
  | "flashcard.deck"
  | "timeline"
  | "faq.accordion"
  | "resource.list"
  | "checklist";

export interface BlockPosition {
  from: number;
  to: number;
}

export interface BlockUIState {
  selected: boolean;
  dragging: boolean;
  resizing: boolean;
}

export interface EducationalBlockSpec<TAttrs extends Record<string, unknown>> {
  kind: EducationalBlockKind;
  title: string;
  description: string;
  defaultAttrs: TAttrs;
  serialize(attrs: TAttrs): Record<string, unknown>;
  deserialize(raw: Record<string, unknown>): TAttrs;
}
