console.log("DogPlaces content.js loaded ✅", window.location.href);

// --- DogPlaces precomputed logo URL ---
let DOGPLACES_LOGO_URL = "";
try {
  DOGPLACES_LOGO_URL = chrome.runtime.getURL("assets/dog-places-logo.png");
} catch (e) {
  console.warn("DogPlaces: could not load logo", e);
}

// ==== 1. CONFIG ====
const SUPABASE_URL = "https://rulpzguobdvpafyvyvlz.supabase.co/rest/v1";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bHB6Z3VvYmR2cGFmeXZ5dmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTk1MTMsImV4cCI6MjA3OTQ5NTUxM30.Z5rkld1YpD3P_djmSuXrtQKjV6-sTIJqoO170teDUj0";

// ======================
// Analytics (anonymous)
// ======================
const ANALYTICS_TABLE = "analytics_events";
const ANALYTICS_USER_KEY = "dogplaces_anon_user_id";

// stable anonymous user id (no PII)
async function getAnonUserId() {
  try {
    if (chrome?.storage?.local) {
      const res = await chrome.storage.local.get([ANALYTICS_USER_KEY]);
      if (res[ANALYTICS_USER_KEY]) return res[ANALYTICS_USER_KEY];

      const id = crypto.randomUUID();
      await chrome.storage.local.set({ [ANALYTICS_USER_KEY]: id });
      return id;
    }
  } catch (_) {}

  const existing = localStorage.getItem(ANALYTICS_USER_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(ANALYTICS_USER_KEY, id);
  return id;
}

async function trackEvent(eventName, { mapsEntityId = null, placeName = null, metadata = null } = {}) {
  try {
    const userId = await getAnonUserId();
    const extensionVersion = chrome?.runtime?.getManifest?.().version ?? null;

    await fetch(`${SUPABASE_URL}/${ANALYTICS_TABLE}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        event_name: eventName,
        maps_entity_id: mapsEntityId,
        place_name: placeName,
        extension_version: extensionVersion,
        metadata,
      }),
    });
  } catch (_) {
    // analytics must never break UX
  }
}

// ======================
// 2. Small helpers
// ======================
function formatPrimarySource(source) {
  if (!source) return null;
  const s = String(source).toLowerCase().trim();

  switch (s) {
    case "user":
      return "fellow dog owner";
    case "google listing":
    case "google":
      return "Google listing";
    case "website":
      return "website";
    case "phone":
      return "phone";
    default:
      return source;
  }
}

function formatConfirmedBy(confirmedBy) {
  const v = String(confirmedBy || "").toLowerCase().trim();
  if (v === "community") return "Fellow dog owner";
  if (v === "dogplaces") return "DogPlaces (Toffee)";
  return confirmedBy || null;
}

function formatMethod(method) {
  const v = String(method || "").toLowerCase().trim();
  if (!v) return null;

  if (v === "called" || v === "phone") return "phoned"; // display label
  if (v === "visited") return "visited";
  if (v === "website") return "website";

  return method; // fallback
}

function formatConfidence(confidence) {
  if (!confidence) return null;
  const s = String(confidence).toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatUpdatedAt(updatedAt) {
  if (!updatedAt) return null;
  try {
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return null;

    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return null;
  }
}

// ======================
// URL / PLACE HELPERS
// ======================
function extractMapsEntityIdFromUrl(url) {
  if (!url) return null;

  // Google often includes multiple !1s... tokens (nearby places etc.)
  // The selected place is typically the LAST one.
  const matches = [...url.matchAll(/!1s([^!]+)/g)];
  if (!matches.length) return null;
  return decodeURIComponent(matches[matches.length - 1][1]);
}

function getCurrentMapsEntityId() {
  // Primary: URL (works for most place-panel navigations)
  const fromUrl = extractMapsEntityIdFromUrl(location.href);
  if (fromUrl) return fromUrl;

  // Fallback: sometimes Maps updates state before URL; try APP_INITIALIZATION_STATE
  try {
    const s = JSON.stringify(window.APP_INITIALIZATION_STATE || "");
    const m = s.match(/(!1s([^!]+))/);
    if (m && m[2]) return decodeURIComponent(m[2]);
  } catch (e) {}

  return null;
}

function extractPlaceNameFromUrl(url) {
  // pattern: /place/NAME/@
  const match = url.match(/\/place\/([^/@]+)\/@/);
  if (match && match[1]) {
    const decoded = decodeURIComponent(match[1].replace(/\+/g, " "));
    console.log("DogPlaces – extracted Place NAME:", decoded);
    return decoded;
  }
  return null;
}

// ======================
// 3. SUPABASE FETCHERS
// ======================
async function fetchCuratedPlaceById(mapsEntityId) {
  if (!mapsEntityId) return null;

  const url = `${SUPABASE_URL}/places?maps_entity_id=eq.${encodeURIComponent(mapsEntityId)}&select=*`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] || null;
  } catch (e) {
    console.error("DogPlaces – curated fetch error:", e);
    return null;
  }
}

async function fetchLatestCommunityRecord(mapsEntityId) {
  if (!mapsEntityId) return null;

  const url =
    `${SUPABASE_URL}/user_submitted_records?maps_entity_id=eq.${encodeURIComponent(mapsEntityId)}` +
    `&confirmed_by=eq.community&select=*` +
    `&order=reported_at.desc&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] || null;
  } catch (e) {
    console.error("DogPlaces – community fetch error:", e);
    return null;
  }
}

function normalizePlaceForRender(record, source) {
  if (!record) return null;

  return {
    dog_status: record.dog_status,
    confirmed_by: record.confirmed_by || (source === "community" ? "community" : "dogplaces"),
    confirmation_method:
      record.confirmation_method ||
      record.primary_source || // TEMP fallback until you delete primary_source
      record.method ||
      null,
     updated_at: record.updated_at || record.reported_at || record.created_at || null,
  };
}

async function resolvePlaceForWidget(mapsEntityId) {
  // 1) Curated wins
  const curated = await fetchCuratedPlaceById(mapsEntityId);
  if (curated && curated.dog_status) return normalizePlaceForRender(curated, "curated");

  // 2) Community fallback
  const community = await fetchLatestCommunityRecord(mapsEntityId);
  if (community && community.dog_status) {
    const mapped = {
      dog_status: community.dog_status,
      confirmed_by: "community",
      confirmation_method: community.confirmation_method,
      updated_at: community.reported_at || community.created_at,
};

    return normalizePlaceForRender(mapped, "community");
  }

  return null;
}

console.log("DogPlaces resolver loaded");

// ======================
// 4. SUBMIT HELPER
// ======================

function extractPlaceMetaFromPage() {
  // ---- NAME ----
  const name =
    document.querySelector('h1.DUwDvf')?.textContent?.trim() ||
    document.querySelector('h1[class*="DUwDvf"]')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
    document.title?.split(" - ")[0]?.trim() ||
    null;

  // ---- ADDRESS ----
  const ariaAddress =
    document.querySelector('[aria-label^="Address:"]')?.getAttribute("aria-label") ||
    document.querySelector('button[aria-label^="Address:"]')?.getAttribute("aria-label") ||
    null;

  const cleanedAria = ariaAddress
    ? ariaAddress.replace(/^Address:\s*/i, "").trim()
    : null;

  const textAddress =
    document.querySelector('[data-item-id="address"]')?.textContent?.trim() ||
    document.querySelector('button[data-tooltip="Copy address"]')?.textContent?.trim() ||
    null;

  const address =
    cleanedAria && cleanedAria.length > 5
      ? cleanedAria
      : textAddress && textAddress.length > 5
      ? textAddress
      : null;

  return {
    place_name: name || null,
    place_address: address || null,
    place_url: location.href,
  };
}

async function submitCommunityDogStatus({
  maps_entity_id,
  dog_status,
  confirmation_method,
  note,
  evidence_url,
  place_name,
  place_address,
  place_url
}) {
  const url = `${SUPABASE_URL}/user_submitted_records`;

 const payload = {
  maps_entity_id,
  dog_status,
  confirmed_by: "community",
  confirmation_method,
  reported_at: new Date().toISOString(),

  // ✅ snapshot metadata
  place_name: place_name || null,
  place_address: place_address || null,
  place_url: place_url || location.href,
};
  console.log("DogPlaces – submitting community record:", payload);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

   if (!res.ok) {
    const errorText = await res.text();
    console.error("DogPlaces – submit failed:", res.status, errorText);
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }

  return true;
}

// ======================
// 5. DOGPLACES WIDGET UI
// ======================

// ---- Collapsed cards ----
function getDogFriendlyCollapsedHtml() {
  return `
<div class="w-[260px] rounded-lg shadow-sm bg-card border border-primary/20 p-4 text-card-foreground space-y-3">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-full flex items-center justify-center relative bg-success/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-4 h-4 text-success">
          <path d="M11.25 16.25h1.5L12 17z"></path>
          <path d="M16 14v.5"></path>
          <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
          <path d="M8 14v.5"></path>
          <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
        </svg>
      </div>
      <span class="font-bold text-foreground text-sm">Dog Friendly</span>
    </div>
    <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--collapsed" alt="DogPlaces logo">
  </div>
</div>`;
}

function getTerraceCollapsedHtml() {
  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-3 border-2 border-primary/30 bg-card">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-full flex items-center justify-center relative bg-warning/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-4 h-4 text-warning">
          <path d="M11.25 16.25h1.5L12 17z"></path>
          <path d="M16 14v.5"></path>
          <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
          <path d="M8 14v.5"></path>
          <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
        </svg>
      </div>
      <span class="font-bold text-foreground text-sm">Terrace Only</span>
    </div>
    <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--collapsed" alt="DogPlaces logo">
  </div>
</div>`;
}

function getNoDogsCollapsedHtml() {
  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-3 border-2 border-primary/30 bg-card">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-full flex items-center justify-center relative bg-destructive/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-4 h-4 text-destructive">
          <path d="M11.25 16.25h1.5L12 17z"></path>
          <path d="M16 14v.5"></path>
          <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
          <path d="M8 14v.5"></path>
          <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823 .47 4.113 6.006 4 7-.08 .703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-6 h-0.5 bg-destructive rotate-45 rounded-full"></div>
        </div>
      </div>
      <span class="font-bold text-foreground text-sm">No Dogs Allowed</span>
    </div>
    <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--collapsed" alt="DogPlaces logo">
  </div>
</div>`;
}

function getUnknownCollapsedHtml() {
  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-3 border-2 border-primary/30 bg-card transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/50 duration-300">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-full flex items-center justify-center relative bg-muted">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-4 h-4 text-muted-foreground">
          <path d="M11.25 16.25h1.5L12 17z"></path>
          <path d="M16 14v.5"></path>
          <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
          <path d="M8 14v.5"></path>
          <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
        </svg>
      </div>
      <span class="font-bold text-foreground text-sm">Not Known</span>
    </div>

    <div class="flex items-center gap-2">
     <button
  	id="dogplaces-add-details-btn"
  	class="dogplaces-btn dogplaces-btn--compact"
	>+ Add</button>


      <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--collapsed" alt="DogPlaces logo">
    </div>
  </div>
</div>`;
}

function getAddDetailsFormHtml() {
  return `
  <div class="dogplaces-add-form">
    <p class="dogplaces-section-title">What is their dog policy?</p>

    <div class="dogplaces-form-group" style="margin-bottom: 10px;">
      <label><input type="radio" name="dog_status" value="dog_friendly"> Dogs allowed inside</label><br>
      <label><input type="radio" name="dog_status" value="terrace_only"> Dogs only on the terrace</label><br>
      <label><input type="radio" name="dog_status" value="no_dogs"> No dogs allowed</label>
    </div>

    <div class="dogplaces-form-group" style="margin-bottom: 10px;">
      <p class="dogplaces-section-title">How do you know this?</p>
      <label><input type="radio" name="confirmation_method" value="visited"> I visited</label><br>
      <label><input type="radio" name="confirmation_method" value="called"> I called</label><br>
      <label><input type="radio" name="confirmation_method" value="website"> Website</label>
    </div>

    <button id="dogplaces-submit" class="dogplaces-btn" disabled>Submit</button>
   <div id="dogplaces-submit-status" class="dogplaces-submit-status"></div>
  </div>
  `;
}

// ---- Expanded cards ----

function buildExpandedMetaHtml(place) {
  const confirmedByLabel = formatConfirmedBy(place && place.confirmed_by);

  // Canonical method: confirmation_method (fallback to legacy primary_source while migrating)
  const methodLabel = formatMethod(
    (place && place.confirmation_method) ||
    (place && place.primary_source) ||
    null
  );

  const updatedLabel = formatUpdatedAt(place && place.updated_at);

  const confirmedByHtml = confirmedByLabel
    ? `<div class="flex items-start gap-2 text-sm">
         <span class="text-muted-foreground">Confirmed by:</span>
         <span class="text-foreground font-medium">${confirmedByLabel}</span>
       </div>`
    : "";

  const methodHtml = methodLabel
    ? `<div class="flex items-start gap-2 text-sm">
         <span class="text-muted-foreground">Method:</span>
         <span class="text-foreground font-medium">${methodLabel}</span>
       </div>`
    : "";

  const updatedHtml = updatedLabel
    ? `<div class="flex items-center gap-2 text-xs text-muted-foreground pt-2 mt-1 border-t border-primary/20">
         <span>Updated ${updatedLabel}</span>
       </div>`
    : "";

  return `
    ${confirmedByHtml}
    ${methodHtml}
    ${updatedHtml}
  `;
}

function getDogFriendlyExpandedHtml(place) {
  return `
<div class="dogplaces-expanded-card rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-bold text-foreground">Dog Friendly</span>
      </div>
      <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    ${buildExpandedMetaHtml(place)}

    <div class="text-center text-xs text-muted-foreground">www.dog-places.com</div>
  </div>
</div>`;
}

function getTerraceExpandedHtml(place) {
  return `
<div class="dogplaces-expanded-card rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-bold text-foreground">Terrace Only</span>
      </div>
      <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    ${buildExpandedMetaHtml(place)}

    <div class="text-center text-xs text-muted-foreground">www.dog-places.com</div>
  </div>
</div>`;
}

function getNoDogsExpandedHtml(place) {
  return `
<div class="dogplaces-expanded-card rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-bold text-foreground">No Dogs Allowed</span>
      </div>
      <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    ${buildExpandedMetaHtml(place)}

    <div class="text-center text-xs text-muted-foreground">www.dog-places.com</div>
  </div>
</div>`;
}

function getUnknownExpandedHtml() {
  return `
<div class="dogplaces-expanded-card rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-bold text-foreground">Not Known</span>
      </div>
      <img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    <p class="text-sm text-muted-foreground">Help fellow dog owners by sharing what you know about this place.</p>

    ${getAddDetailsFormHtml()}

    <div class="text-center text-xs text-muted-foreground">www.dog-places.com</div>
  </div>
</div>`;
}

// ---- Choose card based on status ----
function getCollapsedHtmlForStatus(status) {
  switch (status) {
    case "dog_friendly":
      return getDogFriendlyCollapsedHtml();
    case "terrace_only":
      return getTerraceCollapsedHtml();
    case "no_dogs":
      return getNoDogsCollapsedHtml();
    default:
      return getUnknownCollapsedHtml();
  }
}

function getExpandedHtmlForStatus(status, place) {
  switch (status) {
    case "dog_friendly":
      return getDogFriendlyExpandedHtml(place);
    case "terrace_only":
      return getTerraceExpandedHtml(place);
    case "no_dogs":
      return getNoDogsExpandedHtml(place);
    default:
      return getUnknownExpandedHtml();
  }
}


// ======================
// 6. Rendering (single root, stable listeners)
// ======================
function ensureRoot() {
  let root = document.getElementById("dogplaces-root");

  // Create if it doesn't exist
  if (!root) {
    root = document.createElement("div");
    root.id = "dogplaces-root";

    // Only set default position if user hasn't dragged before
    const saved = localStorage.getItem("dogplaces_widget_pos_v1");

    root.style.position = "fixed";
    root.style.zIndex = "9999";

    if (!saved) {
      root.style.bottom = "16px";
      root.style.right = "16px";
    }

    // Make draggable once (safe even if called again, but we only do on create)
    makeDraggable(root);
  }

  // 🔑 CRITICAL: if Maps removed it, re-attach it
  if (!document.body.contains(root)) {
    document.body.appendChild(root);
  }

  return root;
}


function setExpanded(root, isExpanded) {
  const collapsed = root.querySelector(".dogplaces-collapsed");
  const expanded = root.querySelector(".dogplaces-expanded");
  if (!collapsed || !expanded) return;

  const currentlyExpanded = expanded.style.display === "block";
  const willExpand = !!isExpanded;

  // Track only on transition collapsed -> expanded
  if (!currentlyExpanded && willExpand) {
    const mapsEntityId = root.dataset.mapsEntityId || null;
    trackEvent("expand_widget", { mapsEntityId });
  }

  // Optional: track collapse as well
  if (currentlyExpanded && !willExpand) {
    const mapsEntityId = root.dataset.mapsEntityId || null;
    trackEvent("collapse_widget", { mapsEntityId });
  }

  collapsed.style.display = willExpand ? "none" : "block";
  expanded.style.display = willExpand ? "block" : "none";
}

function bindUnknownFormHandlers(root, mapsEntityId) {
  const submitBtn = root.querySelector("#dogplaces-submit");
  const statusEl = root.querySelector("#dogplaces-submit-status");
  if (!submitBtn || !statusEl) return;

  const getSelected = (name) => {
    const el = root.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  };

  const updateSubmitState = () => {
    const dog_status = getSelected("dog_status");
    const confirmation_method = getSelected("confirmation_method");
    submitBtn.disabled = !(dog_status && confirmation_method);
  };

  root.querySelectorAll('input[name="dog_status"], input[name="confirmation_method"]').forEach((el) => {
    el.addEventListener("change", updateSubmitState);
  });

  updateSubmitState();

 submitBtn.addEventListener("click", async (e) => {
 trackEvent("click_submit", { mapsEntityId: root.dataset.mapsEntityId || null });
  e.preventDefault();
  e.stopPropagation();

  const dog_status = getSelected("dog_status");
  const confirmation_method = getSelected("confirmation_method");

  // ✅ extract place snapshot
  const meta = extractPlaceMetaFromPage();

  submitBtn.disabled = true;
  statusEl.textContent = "Submitting…";

  try {
    await submitCommunityDogStatus({
      maps_entity_id: mapsEntityId,
      dog_status,
      confirmation_method,
      ...meta,
    });

    statusEl.textContent = "Thank you! Saved ✅";

    setTimeout(async () => {
      const place = await resolvePlaceForWidget(mapsEntityId);
      renderDogPlacesWidget(place, mapsEntityId);
    }, 600);

  } catch (err) {
    console.error("DogPlaces submit error:", err);
    statusEl.textContent = String(err.message || err);
    updateSubmitState();
  }
});

}

function renderDogPlacesWidget(place, mapsEntityId) {
  const status = place && place.dog_status ? String(place.dog_status).trim() : "unknown";

  const collapsedHtml = getCollapsedHtmlForStatus(status);
  const expandedHtml = getExpandedHtmlForStatus(status, place || null);

  const root = ensureRoot();

 // ✅ Store current place id on the root so all handlers can read it later
  root.dataset.mapsEntityId = mapsEntityId;

  root.innerHTML = `
    <div class="dogplaces-container">
      <div class="dogplaces-collapsed">
        ${collapsedHtml}
      </div>
      <div class="dogplaces-expanded" style="display: none;">
        ${expandedHtml}
      </div>
    </div>
  `;

  const collapsed = root.querySelector(".dogplaces-collapsed");
  const expanded = root.querySelector(".dogplaces-expanded");
  const expandedCard = root.querySelector(".dogplaces-expanded-card");

  // Expand/collapse behaviour:
  if (collapsed) {
    collapsed.addEventListener("click", (e) => {
      e.stopPropagation();
      setExpanded(root, true);
    });
  }

  // Important: DO NOT collapse the whole expanded area on any click.
  // Only collapse when clicking outside the card (the container background).
  if (expanded) {
    expanded.addEventListener("click", () => setExpanded(root, false));
  }

  // Stop clicks inside the card (and form) from collapsing
  if (expandedCard) {
    expandedCard.addEventListener("click", (e) => e.stopPropagation());
  }

  // "+ Add" button explicitly expands
  const addBtn = root.querySelector("#dogplaces-add-details-btn");
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      trackEvent("click_add", { mapsEntityId: root.dataset.mapsEntityId || null });
      e.preventDefault();
      e.stopPropagation();
      setExpanded(root, true);
    });
  }

  // If unknown, bind form logic (only then)
  if (status === "unknown") {
    bindUnknownFormHandlers(root, mapsEntityId);
  }

  console.log("DogPlaces rendered:", { status, mapsEntityId, place });
}

// ======================
// 7. URL watching (fixed)
// ======================
let lastRenderedMapsEntityId = null;

async function renderForCurrentPlace() {
  const mapsEntityId = getCurrentMapsEntityId();

  // If no place detected, you can choose to hide the widget or show Unknown
  if (!mapsEntityId) return;

  // Only re-render when the place changes
  if (mapsEntityId === lastRenderedMapsEntityId) return;
  lastRenderedMapsEntityId = mapsEntityId;

  const place = await resolvePlaceForWidget(mapsEntityId);
  renderDogPlacesWidget(place, mapsEntityId);
}

function startWatchingUrl() {
  console.log("DogPlaces – watching current place changes");

  setInterval(() => {
    renderForCurrentPlace().catch((e) =>
      console.error("DogPlaces – render error:", e)
    );
  }, 600);
}

// ======================
// 8. Draggable (stable)
// ======================
function makeDraggable(el) {
  if (!el) return;

  const STORAGE_KEY = "dogplaces_widget_pos_v1";

  // Restore saved position if present
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      el.style.position = "fixed";
      el.style.left = `${saved.left}px`;
      el.style.top = `${saved.top}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
    }
  } catch (_) {}

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let pointerId = null;

  // Helper: keep within viewport
  function clampToViewport(left, top) {
    const rect = el.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);

    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop),
    };
  }

  // Prefer Pointer Events (works for mouse + trackpad + touch)
  el.addEventListener("pointerdown", (e) => {
    const target = e.target;

    // Don’t start dragging when interacting with form controls or links
    const isInteractive =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "BUTTON" ||
        target.tagName === "LABEL" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.closest("a"));

    if (isInteractive) return;

    // Start dragging
    dragging = true;
    pointerId = e.pointerId;

    // IMPORTANT: convert current position to left/top to avoid snapping
    const rect = el.getBoundingClientRect();
    el.style.position = "fixed";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";

    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    el.classList.add("dragging");

    // Capture pointer so we keep receiving move events even if cursor leaves element
    try {
      el.setPointerCapture(pointerId);
    } catch (_) {}

    e.preventDefault();
    e.stopPropagation();
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (pointerId !== null && e.pointerId !== pointerId) return;

    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;

    const clamped = clampToViewport(newLeft, newTop);

    el.style.left = `${clamped.left}px`;
    el.style.top = `${clamped.top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("dragging");

    // Persist last position
    try {
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
      }
    } catch (_) {}

    pointerId = null;
  }

  el.addEventListener("pointerup", (e) => {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    endDrag();
  });

  el.addEventListener("pointercancel", endDrag);

  // Re-clamp on resize so it never becomes unreachable
  window.addEventListener("resize", () => {
    const rect = el.getBoundingClientRect();
    const clamped = clampToViewport(rect.left, rect.top);
    el.style.left = `${clamped.left}px`;
    el.style.top = `${clamped.top}px`;
  });
}


// ======================
// 9. Init
// ======================
console.log("DogPlaces boot ✅");

window.addEventListener("load", () => {
  setTimeout(() => {
    renderForCurrentPlace();
    startWatchingUrl();
  }, 1200);
});
