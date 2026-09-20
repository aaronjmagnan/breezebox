/**
 * Breeze Box shared database types.
 *
 * Shape matches `supabase gen types typescript --schema public`. Regenerate
 * against the local stack after any migration:
 *
 *   pnpm db:types
 *
 * Do not hand-edit below the Database type: your changes will be overwritten.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      districts: {
        Row: {
          id: string;
          slug: string;
          name: string;
          custom_domain: string | null;
          app_name: string;
          icon_url: string | null;
          theme_color: string;
          sso_domain: string | null;
          contract_start_date: string | null;
          free_period_end_date: string | null;
          status: Database['public']['Enums']['district_status'];
          inactivity_timeout_minutes: number;
          demo_mode: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          custom_domain?: string | null;
          app_name: string;
          icon_url?: string | null;
          theme_color?: string;
          sso_domain?: string | null;
          contract_start_date?: string | null;
          free_period_end_date?: string | null;
          status?: Database['public']['Enums']['district_status'];
          inactivity_timeout_minutes?: number;
          demo_mode?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          custom_domain?: string | null;
          app_name?: string;
          icon_url?: string | null;
          theme_color?: string;
          sso_domain?: string | null;
          contract_start_date?: string | null;
          free_period_end_date?: string | null;
          status?: Database['public']['Enums']['district_status'];
          inactivity_timeout_minutes?: number;
          demo_mode?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          district_id: string;
          name: string;
          site_type: Database['public']['Enums']['site_type'];
          code: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          district_id: string;
          name: string;
          site_type?: Database['public']['Enums']['site_type'];
          code?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          district_id?: string;
          name?: string;
          site_type?: Database['public']['Enums']['site_type'];
          code?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sites_district_id_fkey';
            columns: ['district_id'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['id'];
          },
        ];
      };
      staff: {
        Row: {
          id: string;
          district_id: string;
          site_id: string | null;
          auth_user_id: string | null;
          name: string;
          email: string;
          role: Database['public']['Enums']['staff_role'];
          status: Database['public']['Enums']['staff_status'];
          created_via: Database['public']['Enums']['staff_created_via'];
          district_wide: boolean;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          district_id: string;
          site_id?: string | null;
          auth_user_id?: string | null;
          name: string;
          email: string;
          role?: Database['public']['Enums']['staff_role'];
          status?: Database['public']['Enums']['staff_status'];
          created_via?: Database['public']['Enums']['staff_created_via'];
          district_wide?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          district_id?: string;
          site_id?: string | null;
          auth_user_id?: string | null;
          name?: string;
          email?: string;
          role?: Database['public']['Enums']['staff_role'];
          status?: Database['public']['Enums']['staff_status'];
          created_via?: Database['public']['Enums']['staff_created_via'];
          district_wide?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_district_id_fkey';
            columns: ['district_id'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      tool_instances: {
        Row: {
          id: string;
          district_id: string;
          tool_type: Database['public']['Enums']['tool_type'];
          tool_slug: string;
          status: Database['public']['Enums']['tool_instance_status'];
          name: string;
          description: string | null;
          icon: string | null;
          accent: Database['public']['Enums']['accent_color'];
          sort_order: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          district_id: string;
          tool_type: Database['public']['Enums']['tool_type'];
          tool_slug: string;
          status?: Database['public']['Enums']['tool_instance_status'];
          name: string;
          description?: string | null;
          icon?: string | null;
          accent?: Database['public']['Enums']['accent_color'];
          sort_order?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          district_id?: string;
          tool_type?: Database['public']['Enums']['tool_type'];
          tool_slug?: string;
          status?: Database['public']['Enums']['tool_instance_status'];
          name?: string;
          description?: string | null;
          icon?: string | null;
          accent?: Database['public']['Enums']['accent_color'];
          sort_order?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tool_instances_district_id_fkey';
            columns: ['district_id'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['id'];
          },
        ];
      };
      support_tickets: {
        Row: {
          id: string;
          district_id: string | null;
          source: Database['public']['Enums']['ticket_source'];
          body: string;
          status: Database['public']['Enums']['ticket_status'];
          cluster_id: string | null;
          staff_id: string | null;
          contact_email: string | null;
          device_info: Json;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          district_id?: string | null;
          source?: Database['public']['Enums']['ticket_source'];
          body: string;
          status?: Database['public']['Enums']['ticket_status'];
          cluster_id?: string | null;
          staff_id?: string | null;
          contact_email?: string | null;
          device_info?: Json;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          district_id?: string | null;
          source?: Database['public']['Enums']['ticket_source'];
          body?: string;
          status?: Database['public']['Enums']['ticket_status'];
          cluster_id?: string | null;
          staff_id?: string | null;
          contact_email?: string | null;
          device_info?: Json;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_tickets_district_id_fkey';
            columns: ['district_id'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      learning_cycle_checkins: {
        Row: {
          id: string;
          district_id: string;
          site_id: string;
          principal_staff_id: string | null;
          created_by: string;
          template_version: string;
          entry_method: string;
          checkin_date: string;
          cycle_number: number | null;
          stage: string | null;
          practice: string | null;
          student_need: string | null;
          step_pick_level: string | null;
          step_learn_level: string | null;
          step_try_level: string | null;
          step_see_level: string | null;
          step_check_level: string | null;
          step_pick_note: string | null;
          step_learn_note: string | null;
          step_try_note: string | null;
          step_see_note: string | null;
          step_check_note: string | null;
          working: string | null;
          barrier: string | null;
          next_step: string | null;
          district_support: string | null;
          next_checkin_date: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          district_id: string;
          site_id: string;
          principal_staff_id?: string | null;
          created_by: string;
          template_version?: string;
          entry_method?: string;
          checkin_date: string;
          cycle_number?: number | null;
          stage?: string | null;
          practice?: string | null;
          student_need?: string | null;
          step_pick_level?: string | null;
          step_learn_level?: string | null;
          step_try_level?: string | null;
          step_see_level?: string | null;
          step_check_level?: string | null;
          step_pick_note?: string | null;
          step_learn_note?: string | null;
          step_try_note?: string | null;
          step_see_note?: string | null;
          step_check_note?: string | null;
          working?: string | null;
          barrier?: string | null;
          next_step?: string | null;
          district_support?: string | null;
          next_checkin_date?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          district_id?: string;
          site_id?: string;
          principal_staff_id?: string | null;
          created_by?: string;
          template_version?: string;
          entry_method?: string;
          checkin_date?: string;
          cycle_number?: number | null;
          stage?: string | null;
          practice?: string | null;
          student_need?: string | null;
          step_pick_level?: string | null;
          step_learn_level?: string | null;
          step_try_level?: string | null;
          step_see_level?: string | null;
          step_check_level?: string | null;
          step_pick_note?: string | null;
          step_learn_note?: string | null;
          step_try_note?: string | null;
          step_see_note?: string | null;
          step_check_note?: string | null;
          working?: string | null;
          barrier?: string | null;
          next_step?: string | null;
          district_support?: string | null;
          next_checkin_date?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'learning_cycle_checkins_district_id_fkey';
            columns: ['district_id'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'learning_cycle_checkins_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'learning_cycle_checkins_principal_staff_id_fkey';
            columns: ['principal_staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'learning_cycle_checkins_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      learning_cycle_checkin_revisions: {
        Row: {
          id: string;
          checkin_id: string;
          district_id: string;
          site_id: string;
          changed_by: string | null;
          changed_at: string;
          action: string;
          changes: Json;
        };
        Insert: {
          id?: string;
          checkin_id: string;
          district_id: string;
          site_id: string;
          changed_by?: string | null;
          changed_at?: string;
          action: string;
          changes?: Json;
        };
        Update: {
          id?: string;
          checkin_id?: string;
          district_id?: string;
          site_id?: string;
          changed_by?: string | null;
          changed_at?: string;
          action?: string;
          changes?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'learning_cycle_checkin_revisions_checkin_id_fkey';
            columns: ['checkin_id'];
            isOneToOne: false;
            referencedRelation: 'learning_cycle_checkins';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'learning_cycle_checkin_revisions_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      access_log: {
        Row: {
          id: number;
          admin_user_id: string | null;
          district_id: string | null;
          accessed_table: string;
          reason: string | null;
          masked: boolean;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          admin_user_id?: string | null;
          district_id?: string | null;
          accessed_table: string;
          reason?: string | null;
          masked?: boolean;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          admin_user_id?: string | null;
          district_id?: string | null;
          accessed_table?: string;
          reason?: string | null;
          masked?: boolean;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'access_log_district_id_fkey';
            columns: ['district_id'];
            isOneToOne: false;
            referencedRelation: 'districts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_district_branding: {
        Args: { host: string };
        Returns: {
          id: string;
          name: string;
          app_name: string;
          icon_url: string | null;
          theme_color: string;
          sso_domain: string | null;
          status: Database['public']['Enums']['district_status'];
          demo_mode: boolean;
        }[];
      };
      claim_staff_membership: {
        Args: { p_district_id: string };
        Returns: Database['public']['Tables']['staff']['Row'];
      };
      touch_current_staff: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      accent_color: 'blue' | 'teal' | 'amber' | 'coral';
      district_status: 'active' | 'expired' | 'paid';
      site_type:
        | 'elementary'
        | 'middle'
        | 'high'
        | 'combined'
        | 'district_office'
        | 'other';
      staff_created_via: 'sso_first_login' | 'manual_entry';
      staff_role: 'staff' | 'site_admin' | 'district_admin';
      staff_status: 'active' | 'inactive';
      ticket_source: 'in_app' | 'email';
      ticket_status:
        | 'open'
        | 'in_progress'
        | 'waiting_on_user'
        | 'resolved'
        | 'closed';
      tool_instance_status: 'active' | 'disabled' | 'coming_soon';
      tool_type: 'data' | 'workflow' | 'impact';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row'];

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];

export type Enums<T extends keyof PublicSchema['Enums']> =
  PublicSchema['Enums'][T];

export type FunctionReturns<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns'];
