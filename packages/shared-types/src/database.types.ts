export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bestiary_entries: {
        Row: {
          campaign_id: string | null
          created_at: string
          data: Json
          id: string
          name: string
          notes: string
          origin: string
          owner_id: string
          source_ref: string | null
          system_id: string
          token_url: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          name: string
          notes?: string
          origin?: string
          owner_id: string
          source_ref?: string | null
          system_id: string
          token_url?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          name?: string
          notes?: string
          origin?: string
          owner_id?: string
          source_ref?: string | null
          system_id?: string
          token_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bestiary_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bestiary_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_campaigns: {
        Row: {
          active_scene_id: string | null
          archived_at: string | null
          created_at: string
          description: string
          dm_id: string
          id: string
          invite_code: string
          invite_enabled: boolean
          last_session_at: string | null
          locale: string
          name: string
          next_session_at: string | null
          progression_enabled: boolean
          seats: number
          shared_resources: Json
          system_id: string
          system_version: string
          updated_at: string
          visibility: string
        }
        Insert: {
          active_scene_id?: string | null
          archived_at?: string | null
          created_at?: string
          description?: string
          dm_id: string
          id?: string
          invite_code?: string
          invite_enabled?: boolean
          last_session_at?: string | null
          locale?: string
          name: string
          next_session_at?: string | null
          progression_enabled?: boolean
          seats?: number
          shared_resources?: Json
          system_id: string
          system_version: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          active_scene_id?: string | null
          archived_at?: string | null
          created_at?: string
          description?: string
          dm_id?: string
          id?: string
          invite_code?: string
          invite_enabled?: boolean
          last_session_at?: string | null
          locale?: string
          name?: string
          next_session_at?: string | null
          progression_enabled?: boolean
          seats?: number
          shared_resources?: Json
          system_id?: string
          system_version?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_active_scene_fk"
            columns: ["active_scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_campaigns_dm_id_fkey"
            columns: ["dm_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_members: {
        Row: {
          campaign_id: string
          character_id: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_members_character_fk"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_requests: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          message: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          archived_at: string | null
          avatar_url: string | null
          campaign_id: string
          color: string | null
          concept: string | null
          created_at: string
          created_by: string | null
          data: Json
          derived: Json
          health: string | null
          id: string
          kind: string
          name: string
          owner_id: string | null
          token_url: string | null
          updated_at: string
          xp: number
        }
        Insert: {
          archived_at?: string | null
          avatar_url?: string | null
          campaign_id: string
          color?: string | null
          concept?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          derived?: Json
          health?: string | null
          id?: string
          kind?: string
          name: string
          owner_id?: string | null
          token_url?: string | null
          updated_at?: string
          xp?: number
        }
        Update: {
          archived_at?: string | null
          avatar_url?: string | null
          campaign_id?: string
          color?: string | null
          concept?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          derived?: Json
          health?: string | null
          id?: string
          kind?: string
          name?: string
          owner_id?: string | null
          token_url?: string | null
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      characters_audit: {
        Row: {
          after: Json | null
          at: string
          author_id: string | null
          before: Json | null
          campaign_id: string
          character_id: string
          field: string
          id: number
          origin: string
        }
        Insert: {
          after?: Json | null
          at?: string
          author_id?: string | null
          before?: Json | null
          campaign_id: string
          character_id: string
          field: string
          id?: number
          origin?: string
        }
        Update: {
          after?: Json | null
          at?: string
          author_id?: string | null
          before?: Json | null
          campaign_id?: string
          character_id?: string
          field?: string
          id?: number
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_audit_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_attacks: {
        Row: {
          answered_at: string | null
          attacker_character_id: string | null
          attacker_name: string
          attacker_token_id: string | null
          campaign_id: string
          created_at: string
          created_by: string
          defence_dice: number | null
          dice: number
          id: string
          request: Json
          roll_id: string | null
          scene_id: string | null
          status: string
          target_character_id: string | null
          target_token_id: string | null
        }
        Insert: {
          answered_at?: string | null
          attacker_character_id?: string | null
          attacker_name?: string
          attacker_token_id?: string | null
          campaign_id: string
          created_at?: string
          created_by: string
          defence_dice?: number | null
          dice: number
          id?: string
          request: Json
          roll_id?: string | null
          scene_id?: string | null
          status?: string
          target_character_id?: string | null
          target_token_id?: string | null
        }
        Update: {
          answered_at?: string | null
          attacker_character_id?: string | null
          attacker_name?: string
          attacker_token_id?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string
          defence_dice?: number | null
          dice?: number
          id?: string
          request?: Json
          roll_id?: string | null
          scene_id?: string | null
          status?: string
          target_character_id?: string | null
          target_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dice_attacks_attacker_character_id_fkey"
            columns: ["attacker_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_attacker_token_id_fkey"
            columns: ["attacker_token_id"]
            isOneToOne: false
            referencedRelation: "maps_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "dice_rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_target_character_id_fkey"
            columns: ["target_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_attacks_target_token_id_fkey"
            columns: ["target_token_id"]
            isOneToOne: false
            referencedRelation: "maps_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_combat_slots: {
        Row: {
          campaign_id: string
          character_id: string | null
          combat_id: string
          created_at: string
          id: string
          name: string
          position: number
          spent_next: number
          token_id: string | null
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          combat_id: string
          created_at?: string
          id?: string
          name?: string
          position: number
          spent_next?: number
          token_id?: string | null
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          combat_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          spent_next?: number
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dice_combat_slots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_combat_slots_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_combat_slots_combat_id_fkey"
            columns: ["combat_id"]
            isOneToOne: false
            referencedRelation: "dice_combats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_combat_slots_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "maps_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_combats: {
        Row: {
          campaign_id: string
          closed_at: string | null
          created_at: string
          created_by: string
          current_position: number
          id: string
          round: number
          scene_id: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          closed_at?: string | null
          created_at?: string
          created_by: string
          current_position?: number
          id?: string
          round?: number
          scene_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string
          current_position?: number
          id?: string
          round?: number
          scene_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dice_combats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_combats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_combats_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_roll_requests: {
        Row: {
          answered_at: string | null
          batch_id: string
          campaign_id: string
          created_at: string
          created_by: string
          difficulty: number
          id: string
          roll_id: string | null
          specialty_allowed: boolean
          stat: string
          status: string
          target_character_id: string
        }
        Insert: {
          answered_at?: string | null
          batch_id?: string
          campaign_id: string
          created_at?: string
          created_by: string
          difficulty: number
          id?: string
          roll_id?: string | null
          specialty_allowed?: boolean
          stat: string
          status?: string
          target_character_id: string
        }
        Update: {
          answered_at?: string | null
          batch_id?: string
          campaign_id?: string
          created_at?: string
          created_by?: string
          difficulty?: number
          id?: string
          roll_id?: string | null
          specialty_allowed?: boolean
          stat?: string
          status?: string
          target_character_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dice_roll_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_roll_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_roll_requests_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "dice_rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_roll_requests_target_character_id_fkey"
            columns: ["target_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          author_id: string
          campaign_id: string
          character_id: string | null
          corrects_id: string | null
          created_at: string
          dice: Json
          id: string
          kind: string
          request: Json
          result: Json
          system_id: string | null
          title: string
          visibility: string
        }
        Insert: {
          author_id: string
          campaign_id: string
          character_id?: string | null
          corrects_id?: string | null
          created_at?: string
          dice: Json
          id?: string
          kind: string
          request: Json
          result: Json
          system_id?: string | null
          title?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          campaign_id?: string
          character_id?: string | null
          corrects_id?: string | null
          created_at?: string
          dice?: Json
          id?: string
          kind?: string
          request?: Json
          result?: Json
          system_id?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "dice_rolls_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_rolls_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_rolls_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "dice_rolls"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_drawings: {
        Row: {
          author_id: string
          campaign_id: string
          color: string
          created_at: string
          data: Json
          id: string
          kind: string
          layer_id: string | null
          scene_id: string
          width: number
        }
        Insert: {
          author_id: string
          campaign_id: string
          color?: string
          created_at?: string
          data: Json
          id?: string
          kind: string
          layer_id?: string | null
          scene_id: string
          width?: number
        }
        Update: {
          author_id?: string
          campaign_id?: string
          color?: string
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          layer_id?: string | null
          scene_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "maps_drawings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_drawings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_drawings_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "maps_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_drawings_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_fog: {
        Row: {
          campaign_id: string
          explored: Json
          scene_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          explored?: Json
          scene_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          explored?: Json
          scene_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maps_fog_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_fog_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_fog_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_images: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "maps_images_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_layers: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          image_url: string | null
          kind: string
          locked: boolean
          mask_url: string | null
          mask_version: number
          name: string
          scene_id: string
          sort_order: number
          transform: Json
          updated_at: string
          visible: boolean
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind: string
          locked?: boolean
          mask_url?: string | null
          mask_version?: number
          name?: string
          scene_id: string
          sort_order?: number
          transform?: Json
          updated_at?: string
          visible?: boolean
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          locked?: boolean
          mask_url?: string | null
          mask_version?: number
          name?: string
          scene_id?: string
          sort_order?: number
          transform?: Json
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "maps_layers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_layers_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_lights: {
        Row: {
          campaign_id: string
          casts_shadow: boolean
          color: string
          cone_angle: number
          created_at: string
          flicker: boolean
          id: string
          kind: string
          layer_id: string | null
          range_m: number
          rotation: number
          scene_id: string
          shape: string
          spin_ms: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          casts_shadow?: boolean
          color?: string
          cone_angle?: number
          created_at?: string
          flicker?: boolean
          id?: string
          kind?: string
          layer_id?: string | null
          range_m?: number
          rotation?: number
          scene_id: string
          shape?: string
          spin_ms?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Update: {
          campaign_id?: string
          casts_shadow?: boolean
          color?: string
          cone_angle?: number
          created_at?: string
          flicker?: boolean
          id?: string
          kind?: string
          layer_id?: string | null
          range_m?: number
          rotation?: number
          scene_id?: string
          shape?: string
          spin_ms?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "maps_lights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_lights_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "maps_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_lights_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_props: {
        Row: {
          campaign_id: string | null
          category: string
          created_at: string
          default_block_shape: string
          default_blocks_move: boolean
          default_blocks_sight: boolean
          default_scale: number
          id: string
          image_url: string
          name: string
          natural_height: number
          natural_width: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          campaign_id?: string | null
          category?: string
          created_at?: string
          default_block_shape?: string
          default_blocks_move?: boolean
          default_blocks_sight?: boolean
          default_scale?: number
          id?: string
          image_url: string
          name?: string
          natural_height: number
          natural_width: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          campaign_id?: string | null
          category?: string
          created_at?: string
          default_block_shape?: string
          default_blocks_move?: boolean
          default_blocks_sight?: boolean
          default_scale?: number
          id?: string
          image_url?: string
          name?: string
          natural_height?: number
          natural_width?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maps_props_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_props_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_scene_props: {
        Row: {
          block_dx: number
          block_dy: number
          block_h: number
          block_shape: string
          block_w: number
          blocks_move: boolean
          blocks_sight: boolean
          campaign_id: string
          created_at: string
          height: number
          id: string
          image_url: string
          layer_id: string | null
          name: string
          prop_id: string | null
          rotation: number
          scene_id: string
          updated_at: string
          width: number
          x: number
          y: number
        }
        Insert: {
          block_dx?: number
          block_dy?: number
          block_h?: number
          block_shape?: string
          block_w?: number
          blocks_move?: boolean
          blocks_sight?: boolean
          campaign_id: string
          created_at?: string
          height: number
          id?: string
          image_url: string
          layer_id?: string | null
          name?: string
          prop_id?: string | null
          rotation?: number
          scene_id: string
          updated_at?: string
          width: number
          x?: number
          y?: number
        }
        Update: {
          block_dx?: number
          block_dy?: number
          block_h?: number
          block_shape?: string
          block_w?: number
          blocks_move?: boolean
          blocks_sight?: boolean
          campaign_id?: string
          created_at?: string
          height?: number
          id?: string
          image_url?: string
          layer_id?: string | null
          name?: string
          prop_id?: string | null
          rotation?: number
          scene_id?: string
          updated_at?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "maps_scene_props_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_scene_props_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "maps_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_scene_props_prop_id_fkey"
            columns: ["prop_id"]
            isOneToOne: false
            referencedRelation: "maps_props"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_scene_props_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_scenes: {
        Row: {
          bg_color: string
          bg_image_url: string | null
          bg_transform: Json
          campaign_id: string
          created_at: string
          created_by: string | null
          fog_mode: string
          grid: Json
          height: number
          id: string
          lighting: string
          name: string
          night_radius_m: number
          solid_walls: boolean
          sort_order: number
          updated_at: string
          visible_players: boolean
          width: number
        }
        Insert: {
          bg_color?: string
          bg_image_url?: string | null
          bg_transform?: Json
          campaign_id: string
          created_at?: string
          created_by?: string | null
          fog_mode?: string
          grid?: Json
          height?: number
          id?: string
          lighting?: string
          name: string
          night_radius_m?: number
          solid_walls?: boolean
          sort_order?: number
          updated_at?: string
          visible_players?: boolean
          width?: number
        }
        Update: {
          bg_color?: string
          bg_image_url?: string | null
          bg_transform?: Json
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          fog_mode?: string
          grid?: Json
          height?: number
          id?: string
          lighting?: string
          name?: string
          night_radius_m?: number
          solid_walls?: boolean
          sort_order?: number
          updated_at?: string
          visible_players?: boolean
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "maps_scenes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_scenes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_tokens: {
        Row: {
          bestiary_entry_id: string | null
          bestiary_ref: string | null
          campaign_id: string
          character_id: string | null
          color: string | null
          controlled_by: string | null
          created_at: string
          id: string
          image_url: string | null
          layer_id: string | null
          name: string
          scene_id: string
          size: number
          state: Json
          updated_at: string
          visible: boolean
          vision_radius: number | null
          x: number
          y: number
        }
        Insert: {
          bestiary_entry_id?: string | null
          bestiary_ref?: string | null
          campaign_id: string
          character_id?: string | null
          color?: string | null
          controlled_by?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          layer_id?: string | null
          name?: string
          scene_id: string
          size?: number
          state?: Json
          updated_at?: string
          visible?: boolean
          vision_radius?: number | null
          x?: number
          y?: number
        }
        Update: {
          bestiary_entry_id?: string | null
          bestiary_ref?: string | null
          campaign_id?: string
          character_id?: string | null
          color?: string | null
          controlled_by?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          layer_id?: string | null
          name?: string
          scene_id?: string
          size?: number
          state?: Json
          updated_at?: string
          visible?: boolean
          vision_radius?: number | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "maps_tokens_bestiary_entry_id_fkey"
            columns: ["bestiary_entry_id"]
            isOneToOne: false
            referencedRelation: "bestiary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_tokens_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_tokens_controlled_by_fkey"
            columns: ["controlled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_tokens_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "maps_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_tokens_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      maps_walls: {
        Row: {
          blocks_move: boolean
          blocks_sight: boolean
          campaign_id: string
          created_at: string
          id: string
          is_open: boolean
          kind: string
          scene_id: string
          visible_players: boolean
          x1: number
          x2: number
          y1: number
          y2: number
        }
        Insert: {
          blocks_move?: boolean
          blocks_sight?: boolean
          campaign_id: string
          created_at?: string
          id?: string
          is_open?: boolean
          kind?: string
          scene_id: string
          visible_players?: boolean
          x1: number
          x2: number
          y1: number
          y2: number
        }
        Update: {
          blocks_move?: boolean
          blocks_sight?: boolean
          campaign_id?: string
          created_at?: string
          id?: string
          is_open?: boolean
          kind?: string
          scene_id?: string
          visible_players?: boolean
          x1?: number
          x2?: number
          y1?: number
          y2?: number
        }
        Relationships: [
          {
            foreignKeyName: "maps_walls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maps_walls_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "maps_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_system: boolean
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          alias: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          locale: string
          name: string
          role_id: string
          theme_pref: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          alias?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          locale?: string
          name: string
          role_id: string
          theme_pref?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          alias?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string
          name?: string
          role_id?: string
          theme_pref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      campaign_invite_preview: {
        Args: { code: string }
        Returns: {
          dm_name: string
          id: string
          name: string
          seats: number
          system_id: string
          taken: number
        }[]
      }
      campaigns_my_invite_code: { Args: { cid: string }; Returns: string }
      campaigns_new_code: { Args: never; Returns: string }
      campaigns_players_count: { Args: { cid: string }; Returns: number }
      campaigns_regenerate_invite_code: {
        Args: { cid: string }
        Returns: string
      }
      campaigns_resolve_request: {
        Args: { accept: boolean; req: string }
        Returns: undefined
      }
      can_create_campaigns: { Args: never; Returns: boolean }
      characters_api_update: {
        Args: { actor: string; cid: string; origin: string; patch: Json }
        Returns: undefined
      }
      characters_audit_origin: { Args: never; Returns: string }
      characters_claim: { Args: { cid: string }; Returns: undefined }
      characters_update_with_origin: {
        Args: { cid: string; origin: string; patch: Json }
        Returns: undefined
      }
      current_role_name: { Args: never; Returns: string }
      dice_advance_turn: {
        Args: { actor: string; kid: string; slot: string }
        Returns: number
      }
      dice_answer_attack: {
        Args: { actor: string; aid: string; defence: number }
        Returns: number
      }
      dice_answer_player_attack: {
        Args: { actor: string; aid: string; defence: number }
        Returns: number
      }
      dice_close_attack: {
        Args: { aid: string; new_status: string; rid: string }
        Returns: undefined
      }
      dice_close_combat: {
        Args: { actor: string; kid: string }
        Returns: undefined
      }
      dice_close_roll_request: {
        Args: { new_status: string; rid: string; roll: string }
        Returns: undefined
      }
      dice_commit_roll: {
        Args: {
          actor: string
          char_id: string
          cid: string
          corrects?: string
          dice: Json
          kind: string
          request: Json
          result: Json
          shared?: Json
          sys_id: string
          title: string
          visibility: string
        }
        Returns: string
      }
      dice_next_turn: { Args: { actor: string; kid: string }; Returns: Json }
      dice_open_attack: {
        Args: {
          actor: string
          attacker: string
          attacker_token: string
          cid: string
          dice_count: number
          req: Json
          sid: string
          target_char: string
          target_token: string
        }
        Returns: string
      }
      dice_open_combat: {
        Args: { actor: string; cid: string; sid: string; slots: Json }
        Returns: string
      }
      dice_open_player_attack: {
        Args: {
          actor: string
          attacker: string
          attacker_char: string
          attacker_token: string
          cid: string
          dice_count: number
          req: Json
          sid: string
          target_token: string
        }
        Returns: string
      }
      dice_open_roll_requests: {
        Args: {
          actor: string
          cid: string
          diff: number
          specialty: boolean
          stat_key: string
          target_chars: string[]
        }
        Returns: string
      }
      has_module: { Args: { module_id: string }; Returns: boolean }
      has_permission: { Args: { perm: string }; Returns: boolean }
      identity_my_sessions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          ip: string
          is_current: boolean
          last_seen_at: string
          user_agent: string
        }[]
      }
      identity_revoke_session: { Args: { sid: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_campaign_dm: { Args: { cid: string }; Returns: boolean }
      is_campaign_member: { Args: { cid: string }; Returns: boolean }
      join_campaign_by_code: { Args: { code: string }; Returns: string }
      maps_layer_sends_to_players: { Args: { lid: string }; Returns: boolean }
      maps_scene_visible: { Args: { sid: string }; Returns: boolean }
      table_reset_resource: {
        Args: { cid: string; rid: string; to_value?: number }
        Returns: Json
      }
      table_return_resource: {
        Args: { cid: string; n?: number; rid: string }
        Returns: Json
      }
      table_spend_hand: {
        Args: { cid: string; rid: string; who: string }
        Returns: number
      }
      table_take_resource: {
        Args: { cid: string; n: number; rid: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

