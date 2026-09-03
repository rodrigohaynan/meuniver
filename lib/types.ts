export type InvitationStatus = "draft" | "published";
export type LayoutKey = "elegant" | "modern" | "kids";

export type Invitation = {
  id: string;
  owner_id: string;
  slug: string;
  status: InvitationStatus;
  event_title: string;
  host_name: string;
  age: number;
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
  hero_image_zoom: number;
  hero_image_x: number;
  hero_image_y: number;
  gift_enabled: boolean;
  rsvp_enabled: boolean;
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
