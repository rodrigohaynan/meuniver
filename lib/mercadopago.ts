import { createHash, randomBytes } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MP_API = "https://api.mercadopago.com";
const MP_AUTH = "https://auth.mercadopago.com/authorization";

export type MercadoPagoSellerAccount = {
  owner_id: string;
  mercado_pago_user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
};

type OAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: number | string;
  refresh_token?: string;
};

export function mercadoPagoConfig() {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Mercado Pago não configurado. Defina MERCADO_PAGO_CLIENT_ID, MERCADO_PAGO_CLIENT_SECRET e NEXT_PUBLIC_APP_URL.",
    );
  }

  const baseUrl = new URL(appUrl);
  const redirectUri = new URL("/api/mercadopago/callback", baseUrl).toString();

  return { clientId, clientSecret, baseUrl, redirectUri };
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildMercadoPagoAuthorizationUrl(state: string, codeChallenge: string) {
  const { clientId, redirectUri } = mercadoPagoConfig();
  const url = new URL(MP_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

async function oauthTokenRequest(payload: Record<string, string>) {
  const response = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as OAuthTokenResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error || "Mercado Pago não retornou um Access Token válido.");
  }

  return data;
}

export async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  const { clientId, clientSecret, redirectUri } = mercadoPagoConfig();
  return oauthTokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
}

async function refreshSellerToken(account: MercadoPagoSellerAccount) {
  if (!account.refresh_token) throw new Error("A conexão com o Mercado Pago precisa ser refeita.");

  const { clientId, clientSecret } = mercadoPagoConfig();
  const data = await oauthTokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
  });

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("marketplace_seller_accounts")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || account.refresh_token,
      token_type: data.token_type || account.token_type,
      scope: data.scope || account.scope,
      expires_at: expiresAt,
    })
    .eq("owner_id", account.owner_id);

  if (error) throw new Error(error.message);

  return data.access_token;
}

export async function getSellerAccessToken(ownerId: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("marketplace_seller_accounts")
    .select("owner_id, mercado_pago_user_id, access_token, refresh_token, token_type, scope, expires_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.access_token) throw new Error("O organizador ainda não conectou a conta Mercado Pago.");

  const account = data as MercadoPagoSellerAccount;
  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : null;
  const refreshSoon = expiresAt !== null && expiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000;

  if (refreshSoon && account.refresh_token) {
    try {
      return await refreshSellerToken(account);
    } catch {
      // Se a renovação preventiva falhar, ainda tentamos o token atual.
    }
  }

  return account.access_token;
}

export async function createMercadoPagoPixPayment({
  accessToken,
  idempotencyKey,
  externalReference,
  amount,
  applicationFee,
  description,
  payerEmail,
  payerName,
  payerCpf,
}: {
  accessToken: string;
  idempotencyKey: string;
  externalReference: string;
  amount: number;
  applicationFee: number;
  description: string;
  payerEmail: string;
  payerName: string;
  payerCpf: string;
}) {
  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: description.slice(0, 150),
      payment_method_id: "pix",
      external_reference: externalReference,
      application_fee: applicationFee,
      payer: {
        email: payerEmail,
        first_name: payerName.slice(0, 100),
        identification: {
          type: "CPF",
          number: payerCpf,
        },
      },
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.id) {
    const message = data?.message || data?.error || data?.cause?.[0]?.description;
    throw new Error(message || "Não foi possível gerar o PIX no Mercado Pago.");
  }

  return data;
}

export async function getMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Não foi possível consultar o pagamento.");
  return data;
}
