// Tipi TypeScript generati dallo schema Supabase
// Per rigenerare: npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type FunnelStage   = "tofu" | "mofu" | "bofu";
export type SourceType    = "brand_owned" | "competitor" | "media" | "review" | "social" | "ecommerce" | "wikipedia" | "other";
export type SegmentName   = string;
export type AnalysisStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AIModel       = "gpt-4o" | "gpt-4o-mini" | "claude-3-5-sonnet" | "gemini-1.5-pro" | "grok-2" | "perplexity-sonar" | "copilot";
export type UserPlan      = "free" | "pro" | "agency";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: UserPlan;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_brand: string;
          known_competitors: string[];
          market_context: string | null;
          language: "it" | "en";
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["projects"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      queries: {
        Row: {
          id: string;
          project_id: string;
          text: string;
          funnel_stage: FunnelStage;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["queries"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["queries"]["Insert"]>;
      };
      audience_segments: {
        Row: {
          id: string;
          project_id: string;
          name: SegmentName;
          label: string;
          prompt_context: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audience_segments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["audience_segments"]["Insert"]>;
      };
      analysis_runs: {
        Row: {
          id: string;
          project_id: string;
          version: number;
          status: AnalysisStatus;
          models_used: AIModel[];
          run_count: number;
          total_prompts: number;
          completed_prompts: number;
          started_at: string | null;
          completed_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["analysis_runs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["analysis_runs"]["Insert"]>;
      };
      prompts_executed: {
        Row: {
          id: string;
          run_id: string;
          query_id: string;
          segment_id: string;
          model: AIModel;
          run_number: number;
          full_prompt_text: string;
          raw_response: string | null;
          response_length: number | null;
          executed_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["prompts_executed"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["prompts_executed"]["Insert"]>;
      };
      response_analysis: {
        Row: {
          id: string;
          prompt_executed_id: string;
          brand_mentioned: boolean;
          brand_rank: number | null;
          brand_occurrences: number;
          sentiment_score: number | null;
          topics: string[];
          competitors_found: string[];
          avi_score: number | null;
          avi_components: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["response_analysis"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["response_analysis"]["Insert"]>;
      };
      sources: {
        Row: {
          id: string;
          prompt_executed_id: string;
          url: string | null;
          domain: string | null;
          label: string | null;
          source_type: SourceType;
          is_brand_owned: boolean;
          context: string | null;
          citation_count: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sources"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
      };
      competitors: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          is_manual: boolean;
          discovered_at_run_id: string | null;
          topic_context: string[];
          query_type: string | null;
          theme_analysis: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["competitors"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["competitors"]["Insert"]>;
      };
      topics: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          first_seen_run_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["topics"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["topics"]["Insert"]>;
      };
      avi_history: {
        Row: {
          id: string;
          project_id: string;
          run_id: string;
          avi_score: number;
          presence_score: number;
          rank_score: number;
          sentiment_score: number;
          stability_score: number;
          computed_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["avi_history"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["avi_history"]["Insert"]>;
      };
    };
  };
}
