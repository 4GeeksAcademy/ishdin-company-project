export type IncidentCategory =
  | "LOST_PARCEL"
  | "DELAYED_DELIVERY"
  | "WRONG_ADDRESS"
  | "RETURN_REQUEST"
  | "DAMAGE";

export type IncidentStatus = "OPEN" | "CLOSED" | "DISCARDED";
export type TrackFlowCountry = "US" | "ES";

export interface IncidentAnalysisResult {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  category_breakdown: Record<IncidentCategory, number>;
  status_breakdown: Record<IncidentStatus, number>;
  average_satisfaction: number;
  invalid_reasons: Record<string, number>;
  country_breakdown?: Record<TrackFlowCountry, number>;
}
