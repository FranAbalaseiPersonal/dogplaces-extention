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

// ==== 2. Small helpers for formatting ====
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
      return source; // fallback to whatever is stored
  }
}

function formatConfidence(confidence) {
  if (!confidence) return null;
  const s = String(confidence).toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1); // high -> High
}

function formatUpdatedAt(updatedAt) {
  if (!updatedAt) return null;
  try {
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return null;

    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`; // DD MMM YYYY
  } catch (e) {
    return null;
  }
}

// ==== 3. Fetch place from Supabase using NAME ====
async function fetchPlaceByName(placeName) {
  if (!placeName) return null;

  const encoded = encodeURIComponent(placeName);
  const url = `${SUPABASE_URL}/places?name=eq.${encoded}&select=*`;

  console.log("DogPlaces – fetching by NAME:", url);

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    console.log("DogPlaces – fetch-by-name HTTP:", res.status);
    const text = await res.text();
    console.log("DogPlaces – fetch-by-name raw:", text);

    if (!res.ok) return null;

    const data = JSON.parse(text);
    return data[0] || null;
  } catch (err) {
    console.error("DogPlaces – fetch-by-name ERROR:", err);
    return null;
  }
}

// ==== 4. Extract place NAME from Maps URL ====
function extractPlaceNameFromUrl(url) {
  // Look for pattern: /place/NAME/@
  const match = url.match(/\/place\/([^/@]+)\/@/);
  if (match && match[1]) {
    const decoded = decodeURIComponent(match[1].replace(/\+/g, " "));
    console.log("DogPlaces – extracted Place NAME:", decoded);
    return decoded;
  }
  console.log("DogPlaces – no place name found in URL");
  return null;
}

// -------------------------
// DOGPLACES WIDGET UI
// -------------------------

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
</div>
  `;
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
</div>
  `;
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
          <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-6 h-0.5 bg-destructive rotate-45 rounded-full"></div>
        </div>
      </div>
      <span class="font-bold text-foreground text-sm">No Dogs Allowed</span>
    </div>
	<img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--collapsed" alt="DogPlaces logo">
  </div>
</div>
  `;
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
	<img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--collapsed" alt="DogPlaces logo">
  </div>
</div>
  `;
}

// ---- Expanded cards ----
function getDogFriendlyExpandedHtml(place) {
  const sourceLabel = formatPrimarySource(place && place.primary_source);
  const confidenceLabel = formatConfidence(place && place.confidence);
  const updatedLabel = formatUpdatedAt(place && place.updated_at);

  const confirmedHtml = sourceLabel
    ? `
    <div class="flex items-start gap-2 text-sm">
      <span class="text-muted-foreground">Confirmed by:</span>
      <span class="text-foreground font-medium">${sourceLabel}</span>
    </div>`
    : "";

  const confidenceHtml = confidenceLabel
    ? `
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Confidence:</span>
      <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs text-foreground font-medium">
        ${confidenceLabel}
      </div>
    </div>`
    : "";

  const updatedHtml = updatedLabel
    ? `
    <div class="flex items-center gap-2 text-xs text-muted-foreground pt-2 mt-1 border-t border-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar w-3.5 h-3.5 text-primary/60">
        <path d="M8 2v4"></path>
        <path d="M16 2v4"></path>
        <rect width="18" height="18" x="3" y="4" rx="2"></rect>
        <path d="M3 10h18"></path>
      </svg>
      <span>Updated ${updatedLabel}</span>
    </div>`
    : "";

  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-full flex items-center justify-center relative bg-success/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-5 h-5 text-success">
            <path d="M11.25 16.25h1.5L12 17z"></path>
            <path d="M16 14v.5"></path>
            <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
            <path d="M8 14v.5"></path>
            <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
          </svg>
        </div>
        <span class="font-bold text-foreground">Dog Friendly</span>
      </div>
	<img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    ${confirmedHtml}
    ${confidenceHtml}
    ${updatedHtml}

    <div class="text-center text-xs text-muted-foreground">
      www.dog-places.com
    </div>

  </div>
</div>
  `;
}

function getTerraceExpandedHtml(place) {
  const sourceLabel = formatPrimarySource(place && place.primary_source);
  const confidenceLabel = formatConfidence(place && place.confidence);
  const updatedLabel = formatUpdatedAt(place && place.updated_at);

  const confirmedHtml = sourceLabel
    ? `
    <div class="flex items-start gap-2 text-sm">
      <span class="text-muted-foreground">Confirmed by:</span>
      <span class="text-foreground font-medium">${sourceLabel}</span>
    </div>`
    : "";

  const confidenceHtml = confidenceLabel
    ? `
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Confidence:</span>
      <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs text-foreground font-medium">
        ${confidenceLabel}
      </div>
    </div>`
    : "";

  const updatedHtml = updatedLabel
    ? `
    <div class="flex items-center gap-2 text-xs text-muted-foreground pt-2 mt-1 border-t border-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar w-3.5 h-3.5 text-primary/60">
        <path d="M8 2v4"></path>
        <path d="M16 2v4"></path>
        <rect width="18" height="18" x="3" y="4" rx="2"></rect>
        <path d="M3 10h18"></path>
      </svg>
      <span>Updated ${updatedLabel}</span>
    </div>`
    : "";

  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-full flex items-center justify-center relative bg-warning/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-5 h-5 text-warning">
            <path d="M11.25 16.25h1.5L12 17z"></path>
            <path d="M16 14v.5"></path>
            <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
            <path d="M8 14v.5"></path>
            <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
          </svg>
        </div>
        <span class="font-bold text-foreground">Terrace Only</span>
      </div>
	<img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    ${confirmedHtml}
    ${confidenceHtml}
    ${updatedHtml}

    <div class="text-center text-xs text-muted-foreground">
      www.dog-places.com
    </div>
  </div>
</div>
  `;
}

function getNoDogsExpandedHtml(place) {
  const sourceLabel = formatPrimarySource(place && place.primary_source);
  const confidenceLabel = formatConfidence(place && place.confidence);
  const updatedLabel = formatUpdatedAt(place && place.updated_at);

  const confirmedHtml = sourceLabel
    ? `
    <div class="flex items-start gap-2 text-sm">
      <span class="text-muted-foreground">Confirmed by:</span>
      <span class="text-foreground font-medium">${sourceLabel}</span>
    </div>`
    : "";

  const confidenceHtml = confidenceLabel
    ? `
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">Confidence:</span>
      <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs text-foreground font-medium">
        ${confidenceLabel}
      </div>
    </div>`
    : "";

  const updatedHtml = updatedLabel
    ? `
    <div class="flex items-center gap-2 text-xs text-muted-foreground pt-2 mt-1 border-t border-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar w-3.5 h-3.5 text-primary/60">
        <path d="M8 2v4"></path>
        <path d="M16 2v4"></path>
        <rect width="18" height="18" x="3" y="4" rx="2"></rect>
        <path d="M3 10h18"></path>
      </svg>
      <span>Updated ${updatedLabel}</span>
    </div>`
    : "";

  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card">
  <div class="space-y-3">

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-full flex items-center justify-center relative bg-destructive/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-5 h-5 text-destructive">
            <path d="M11.25 16.25h1.5L12 17z"></path>
            <path d="M16 14v.5"></path>
            <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
            <path d="M8 14v.5"></path>
            <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-0.5 bg-destructive rotate-45 rounded-full"></div>
          </div>
        </div>
        <span class="font-bold text-foreground">No Dogs Allowed</span>
      </div>
	<img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    ${confirmedHtml}
    ${confidenceHtml}
    ${updatedHtml}

    <div class="text-center text-xs text-muted-foreground">
      www.dog-places.com
    </div>
  </div>
</div>
  `;
}

function getUnknownExpandedHtml() {
  return `
<div class="rounded-lg text-card-foreground shadow-sm w-[260px] p-4 border-2 border-primary/30 bg-card transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/50 duration-300">
  <div class="space-y-3">

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-full flex items-center justify-center relative bg-muted">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dog w-5 h-5 text-muted-foreground">
            <path d="M11.25 16.25h1.5L12 17z"></path>
            <path d="M16 14v.5"></path>
            <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"></path>
            <path d="M8 14v.5"></path>
            <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
          </svg>
        </div>
        <span class="font-bold text-foreground">Not Known</span>
      </div>
	<img src="${DOGPLACES_LOGO_URL}" class="dogplaces-logo dogplaces-logo--expanded" alt="DogPlaces logo">
    </div>

    <p class="text-sm text-muted-foreground">
      Help fellow dog owners by sharing what you know about this place.
    </p>

    <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus w-4 h-4">
        <path d="M5 12h14"></path>
        <path d="M12 5v14"></path>
      </svg>
      Add Details
    </button>

    <div class="text-center text-xs text-muted-foreground">
      www.dog-places.com
    </div>

  </div>
</div>
  `;
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

// ---- Render / update widget ----
function renderDogPlacesWidget(place) {
  const status =
    place && place.dog_status ? String(place.dog_status).trim() : "unknown";

  const collapsedHtml = getCollapsedHtmlForStatus(status);
  const expandedHtml = getExpandedHtmlForStatus(status, place || null);

  let root = document.getElementById("dogplaces-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "dogplaces-root";
    document.body.appendChild(root);

    // Make the whole widget draggable
    makeDraggable(root);
  }

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

  if (collapsed && expanded) {
    collapsed.addEventListener("click", () => {
      collapsed.style.display = "none";
      expanded.style.display = "block";
    });

    expanded.addEventListener("click", () => {
      expanded.style.display = "none";
      collapsed.style.display = "block";
    });
  }
}

// ==== 5. Watch for URL changes in Google Maps ====
let lastUrl = location.href;

function startWatchingUrl() {
  console.log("DogPlaces – starting to watch URL changes");
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log("DogPlaces – URL changed:", lastUrl);

      const placeName = extractPlaceNameFromUrl(lastUrl);

      if (placeName) {
        fetchPlaceByName(placeName).then((place) => {
          renderDogPlacesWidget(place);
        });
      } else {
        renderDogPlacesWidget(null);
      }
    }
  }, 1000); // check every second
}

// ==== 6. Init on load ====
window.addEventListener("load", () => {
  setTimeout(() => {
    renderDogPlacesWidget(null); // start with Unknown
    startWatchingUrl();
  }, 2000);
});

function makeDraggable(el) {
  let offsetX = 0;
  let offsetYFromBottom = 0;
  let isDown = false;

  el.addEventListener("mousedown", function (e) {
    isDown = true;
    el.classList.add("dragging");

    const rect = el.getBoundingClientRect();

    // Horizontal offset from the left edge of the element
    offsetX = e.clientX - rect.left;

    // Vertical offset from the mouse to the BOTTOM of the element
    // (so we can keep anchoring by bottom when moving)
    offsetYFromBottom = rect.bottom - e.clientY;
  });

  document.addEventListener("mouseup", function () {
    isDown = false;
    el.classList.remove("dragging");
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDown) return;

    // Move horizontally using "left"
    el.style.left = e.clientX - offsetX + "px";

    // Compute where the bottom of the element should be,
    // then set the CSS "bottom" property so it always expands UP
    const newBottom = window.innerHeight - (e.clientY + offsetYFromBottom);
    el.style.bottom = newBottom + "px";

    // Ensure we are not anchoring from the top/right anymore
    el.style.top = "auto";
    el.style.right = "auto";
  });
}
