export type InvitationStatus = "draft" | "published";
export type AgeUnit = "years" | "months";
export type LayoutKey = "elegant" | "modern" | "kids";
export type GiftReservationMode = "single" | "multiple";

export type GiftProfileItem = {
  label: string;
  value: string;
};

export type Invitation = {
  id: string;
  owner_id: string;
  slug: string;
  status: InvitationStatus;
  event_title: string;
  host_name: string;
  age: number;
  age_unit: AgeUnit;
  event_date: string | null;
  event_time: string;
  location_name: string;
  address: string;
  maps_url: string;
  invitation_text: string;
  rsvp_note: string;
  theme_key: string;
  layout_key: LayoutKey;
  hero_image_url: string | null;
  share_image_url: string | null;
  hero_image_zoom: number;
  hero_image_x: number;
  hero_image_y: number;
  gift_enabled: boolean;
  gift_profile: GiftProfileItem[];
  rsvp_enabled: boolean;
  pix_gift_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type GiftItem = {
  id: string;
  invitation_id: string;
  name: string;
  description: string;
  price_hint: string;
  suggestion_url: string | null;
  manual_image_url: string | null;
  suggestion_image_url: string | null;
  sort_order: number;
  reserved: boolean;
  reservation_mode: GiftReservationMode;
  created_at: string;
};

export type Rsvp = {
  id: string;
  invitation_id: string;
  contact_name: string;
  whatsapp: string;
  attendees: Array<{ name: string; category: "adult" | "child" }>;
  created_at: string;
};

export type GiftReservation = {
  id: string;
  gift_id: string;
  guest_name: string;
  guest_contact: string;
  reserved_at: string;
};

export type UserProfile = {
  id: string;
  full_name: string;
  sex: "female" | "male" | "other" | "prefer_not_to_say" | "";
  birth_date: string | null;
  state: string;
  city: string;
  whatsapp: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type CashGift = {
  id: string;
  invitation_id: string;
  owner_id: string;
  guest_name: string;
  guest_email: string;
  guest_whatsapp: string;
  amount: number;
  platform_fee: number;
  payment_id: string | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
};
