// The legacy result shape, still used by the top list, bag tags, player profiles and score saving.
export interface MetrixPlayerResult {
  Name: string;
  Sum?: number;
  Diff: number;
  OrderNumber: number;
  ClassName: string;
  Group?: string;
  DNF?: string | null;
}

export type TrackedPlayer = MetrixPlayerResult & { id: number };
