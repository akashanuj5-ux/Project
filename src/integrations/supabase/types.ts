export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          created_at?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      audit_trail: {
        Row: {
          action: string;
          actor_email: string;
          actor_id: string | null;
          actor_name: string;
          actor_role: string;
          changes: Json;
          created_at: string;
          deviation_id: string | null;
          id: string;
          remarks: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string;
          actor_id?: string | null;
          actor_name?: string;
          actor_role?: string;
          changes?: Json;
          created_at?: string;
          deviation_id?: string | null;
          id?: string;
          remarks?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string;
          actor_id?: string | null;
          actor_name?: string;
          actor_role?: string;
          changes?: Json;
          created_at?: string;
          deviation_id?: string | null;
          id?: string;
          remarks?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_trail_deviation_id_fkey";
            columns: ["deviation_id"];
            isOneToOne: false;
            referencedRelation: "deviations";
            referencedColumns: ["id"];
          },
        ];
      };
      deviations: {
        Row: {
          change_type: string;
          custom_fields: Json;
          eco_no: string | null;
          eco_attachment_url: string | null;
          floor_remarks: string | null;
          floor_reviewed_at: string | null;
          floor_reviewed_by: string | null;
          floor_reviewer_name: string | null;
          floor_status: Database["public"]["Enums"]["review_status"];
          fusion_sync: Database["public"]["Enums"]["sync_status"];
          fusion_synced_at: string | null;
          id: string;
          item_name: string;
          last_operation_name: string | null;
          last_seq_no: number | null;
          movement_date: string | null;
          next_dept_code: string | null;
          next_dept_desc: string | null;
          next_op_code: string | null;
          next_seq_no: number | null;
          ppc_remarks: string | null;
          ppc_reviewed_at: string | null;
          ppc_reviewed_by: string | null;
          ppc_reviewer_name: string | null;
          ppc_status: Database["public"]["Enums"]["review_status"];
          proposed_operation: string;
          remarks: string | null;
          requester_email: string;
          requester_id: string | null;
          requester_name: string;
          submitted_at: string;
          supervisor_name: string;
          ticket_no: string;
          updated_at: string;
        };
        Insert: {
          change_type?: string;
          custom_fields?: Json;
          eco_no?: string | null;
          eco_attachment_url?: string | null;
          floor_remarks?: string | null;
          floor_reviewed_at?: string | null;
          floor_reviewed_by?: string | null;
          floor_reviewer_name?: string | null;
          floor_status?: Database["public"]["Enums"]["review_status"];
          fusion_sync?: Database["public"]["Enums"]["sync_status"];
          fusion_synced_at?: string | null;
          id?: string;
          item_name: string;
          last_operation_name?: string | null;
          last_seq_no?: number | null;
          movement_date?: string | null;
          next_dept_code?: string | null;
          next_dept_desc?: string | null;
          next_op_code?: string | null;
          next_seq_no?: number | null;
          ppc_remarks?: string | null;
          ppc_reviewed_at?: string | null;
          ppc_reviewed_by?: string | null;
          ppc_reviewer_name?: string | null;
          ppc_status?: Database["public"]["Enums"]["review_status"];
          proposed_operation: string;
          remarks?: string | null;
          requester_email?: string;
          requester_id?: string | null;
          requester_name?: string;
          submitted_at?: string;
          supervisor_name: string;
          ticket_no: string;
          updated_at?: string;
        };
        Update: {
          change_type?: string;
          custom_fields?: Json;
          eco_no?: string | null;
          eco_attachment_url?: string | null;
          floor_remarks?: string | null;
          floor_reviewed_at?: string | null;
          floor_reviewed_by?: string | null;
          floor_reviewer_name?: string | null;
          floor_status?: Database["public"]["Enums"]["review_status"];
          fusion_sync?: Database["public"]["Enums"]["sync_status"];
          fusion_synced_at?: string | null;
          id?: string;
          item_name?: string;
          last_operation_name?: string | null;
          last_seq_no?: number | null;
          movement_date?: string | null;
          next_dept_code?: string | null;
          next_dept_desc?: string | null;
          next_op_code?: string | null;
          next_seq_no?: number | null;
          ppc_remarks?: string | null;
          ppc_reviewed_at?: string | null;
          ppc_reviewed_by?: string | null;
          ppc_reviewer_name?: string | null;
          ppc_status?: Database["public"]["Enums"]["review_status"];
          proposed_operation?: string;
          remarks?: string | null;
          requester_email?: string;
          requester_id?: string | null;
          requester_name?: string;
          submitted_at?: string;
          supervisor_name?: string;
          ticket_no?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      form_fields: {
        Row: {
          autofill_source: string | null;
          autofill_target: string | null;
          created_at: string;
          field_key: string;
          field_type: string;
          id: string;
          is_core: boolean;
          label: string;
          lookup_column: string | null;
          lookup_enabled: boolean;
          lookup_min_chars: number;
          lookup_mode: string;
          options: string[];
          required: boolean;
          sort_order: number;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          autofill_source?: string | null;
          autofill_target?: string | null;
          created_at?: string;
          field_key: string;
          field_type?: string;
          id?: string;
          is_core?: boolean;
          label: string;
          lookup_column?: string | null;
          lookup_enabled?: boolean;
          lookup_min_chars?: number;
          lookup_mode?: string;
          options?: string[];
          required?: boolean;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          autofill_source?: string | null;
          autofill_target?: string | null;
          created_at?: string;
          field_key?: string;
          field_type?: string;
          id?: string;
          is_core?: boolean;
          label?: string;
          lookup_column?: string | null;
          lookup_enabled?: boolean;
          lookup_min_chars?: number;
          lookup_mode?: string;
          options?: string[];
          required?: boolean;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
      master_routing: {
        Row: {
          created_at: string;
          dept_code: string | null;
          dept_desc: string | null;
          id: string;
          item: string | null;
          op_code: string | null;
          op_desc: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dept_code?: string | null;
          dept_desc?: string | null;
          id?: string;
          item?: string | null;
          op_code?: string | null;
          op_desc?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dept_code?: string | null;
          dept_desc?: string | null;
          id?: string;
          item?: string | null;
          op_code?: string | null;
          op_desc?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          permissions: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          permissions?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          permissions?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "ADMIN" | "REQUESTER" | "FLOOR_MANAGER" | "PPC_REVIEWER" | "VIEWER";
      review_status: "PENDING" | "APPROVED" | "REJECTED" | "NA";
      sync_status: "NOT_SYNCED" | "SYNCED" | "FAILED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "REQUESTER", "FLOOR_MANAGER", "PPC_REVIEWER", "VIEWER"],
      review_status: ["PENDING", "APPROVED", "REJECTED", "NA"],
      sync_status: ["NOT_SYNCED", "SYNCED", "FAILED"],
    },
  },
} as const;
